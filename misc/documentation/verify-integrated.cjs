#!/usr/bin/env node
// Read-only QA for translated documentation; optional verified staging overlay.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const md = require('./markdown.cjs');
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const root = path.resolve(option('--root', path.join(__dirname, '../..')));
const stage = path.join(root, option('--stage', 'build/docs-translation/integration'));
const languages = ['de', 'en', 'ru'];
const state = JSON.parse(fs.readFileSync(path.join(stage, 'state.json'), 'utf8'));
const plan = JSON.parse(fs.readFileSync(path.join(stage, 'changes.json'), 'utf8'));
const key = (repo, relative) => repo + ':' + relative.toLowerCase();
const repositories = [...new Set(state.files.map(file => file.repo))];
const roots = new Map(repositories.map(repo => [repo, repo === 'skymp' ? root : path.join(path.dirname(root), repo)]));
const stateFiles = new Map(state.files.map(file => [key(file.repo, file.path), file]));
const changes = new Map(plan.files.map(file => [key(file.repo, file.path), file]));
const failures = [], existingBrokenLinks = [], warnings = [], inventory = [];
const cache = new Map();
function read(repo, relative) {
  const id = key(repo, relative);
  if (cache.has(id)) return cache.get(id);
  const filename = path.join(roots.get(repo), relative), stateFile = stateFiles.get(id), change = changes.get(id);
  let bytes = fs.existsSync(filename) ? fs.readFileSync(filename) : null;
  const actualSha = bytes ? md.sha(bytes) : null;
  if (stateFile && actualSha !== stateFile.after && !args.includes('--no-overlay') && (repo !== 'skymp' || plan.stageCore)) {
    const overlay = path.join(stage, 'after', repo, relative);
    if (change && fs.existsSync(overlay)) {
      assert(actualSha === change.before || actualSha === change.actualAtPlan, 'Unexpected external file change before overlay: ' + id);
      bytes = fs.readFileSync(overlay);
      assert.equal(md.sha(bytes), stateFile.after, 'Staged integrated document hash changed: ' + id);
    }
  }
  cache.set(id, bytes);
  return bytes;
}
function text(repo, relative) {
  const value = read(repo, relative);
  assert(value, 'Missing file: ' + repo + '/' + relative);
  return value.toString('utf8');
}
function locate(filename) {
  for (const [repo, repositoryRoot] of roots) {
    const relative = md.slash(path.relative(repositoryRoot, filename));
    if (relative && relative !== '..' && !relative.startsWith('../') && !path.isAbsolute(relative)) return { repo, relative };
  }
  return null;
}
function resolve(repo, source, href) {
  const parsed = md.parseHref(href);
  if (!parsed) return null;
  if (parsed.error) return parsed;
  if (parsed.filename.startsWith('/') && !/^[a-z]:/i.test(parsed.filename)) return null;
  const filename = parsed.filename ? path.resolve(roots.get(repo), path.dirname(source), parsed.filename) : path.resolve(roots.get(repo), source);
  const target = locate(filename);
  return target ? { ...target, fragment: parsed.fragment } : { outside: filename, fragment: parsed.fragment };
}
function targetIssue(target) {
  if (target.error) return target.error;
  if (target.outside) return fs.existsSync(target.outside) ? null : 'missing_local_target';
  const filename = path.join(roots.get(target.repo), target.relative);
  if (fs.existsSync(filename) && fs.statSync(filename).isDirectory()) return null;
  const bytes = read(target.repo, target.relative);
  if (!bytes) return 'missing_local_target';
  if (target.fragment && /\.md$/i.test(target.relative) && !md.anchors(bytes.toString('utf8')).has(target.fragment)) return 'missing_heading_anchor';
  return null;
}
const baselineBroken = new Set();
function targetKey(target) {
  if (target.outside) return target.outside.toLowerCase() + '#' + (target.fragment || '');
  const canonical = target.relative.replace(/^docs\/i18n\/(?:de|en|ru)\//, '');
  return key(target.repo, canonical) + '#' + (target.fragment || '');
}
const manifests = new Map();
for (const audit of state.sourceHashRefreshes || []) {
  if (!roots.has(audit.repo)) continue;
  try {
    const original = text(audit.repo, audit.source);
    assert.equal(md.sha(original), audit.sourceSha256, 'Audited source navigation hash mismatch');
    assert.equal(md.sha(md.stripNavigation(original)), audit.sourceBodySha256, 'Audited original body changed');
    assert.equal(audit.sourceBodySha256, audit.translationSourceSha256, 'Audited source content refresh beyond navigation');
  } catch (error) { failures.push({ repo: audit.repo, source: audit.source, reason: error.message }); }
}
for (const repo of repositories) {
  try {
    const manifest = JSON.parse(text(repo, 'docs/i18n/manifest.json'));
    assert.equal(manifest.repository, repo);
    assert.deepEqual(manifest.languages, languages);
    manifests.set(repo, manifest);
    for (const entry of manifest.documents) {
      const source = md.stripNavigation(text(repo, entry.source));
      for (const link of md.links(source)) {
        const target = resolve(repo, entry.source, link.href);
        if (target && !target.error && targetIssue(target)) baselineBroken.add(targetKey(target));
      }
    }
  } catch (error) { failures.push({ repo, reason: error.message }); }
}
let sourceCount = 0, checkedLinks = 0;
const languageFiles = new Set(), checked = new Set();
for (const [repo, manifest] of manifests) {
  const sourcePaths = new Set();
  for (const entry of manifest.documents) {
    sourceCount++;
    try {
      assert(!sourcePaths.has(entry.source), 'Duplicate source in manifest'); sourcePaths.add(entry.source);
      const source = text(repo, entry.source);
      assert.equal(md.sha(source), entry.sourceSha256, 'Source hash mismatch');
      assert.equal(md.sha(md.stripNavigation(source)), entry.sourceBodySha256, 'Source body changed beyond navigation');
      assert.equal(entry.sourceBodySha256, entry.translationSourceSha256, 'Unexpected source hash refresh beyond navigation');
      assert.equal(new Set(Object.values(entry.languages)).size, 3, 'Each language requires its own full document');
      for (const language of languages) {
        const relative = entry.languages[language], body = text(repo, relative), id = key(repo, relative);
        assert(relative.startsWith('docs/i18n/' + language + '/'), 'Language path does not match requested language');
        assert.equal(md.sha(body), entry.outputs[language].sha256, 'Output hash mismatch');
        assert(!/\b(?:TODO_TRANSLATE|TRANSLATION_PENDING|PLACEHOLDER_TRANSLATION)\b/.test(body), 'Unfinished translation marker');
        assert(md.stripNavigation(body).trim(), 'Empty translation');
        languageFiles.add(id);
        // Integration may change links and navigation, never any fenced code bytes.
        // Scope helpers normalized some old source line endings; ignore only CRLF/LF here.
        const canonicalFences = md.spans(source).map(span => span.value.replace(/\r\n/g, '\n').trimEnd());
        const translatedFences = md.spans(body).map(span => span.value.replace(/\r\n/g, '\n').trimEnd());
        if (JSON.stringify(canonicalFences) !== JSON.stringify(translatedFences)) warnings.push({ repo, source: entry.source, language, reason: 'canonical_code_fence_variant_requires_review' });
      }
    } catch (error) { failures.push({ repo, source: entry.source, reason: error.message }); }
  }
  const paths = new Set([...manifest.documents.flatMap(entry => [entry.source, ...Object.values(entry.languages), ...Object.values(entry.languageOrigins || {}).filter(value => !value.startsWith('docs/i18n/'))]), manifest.navigation.gateway, ...Object.values(manifest.navigation.indexes)]);
  for (const relative of paths) {
    const id = key(repo, relative);
    if (checked.has(id)) continue;
    checked.add(id);
    try {
      for (const link of md.links(text(repo, relative))) {
        const target = resolve(repo, relative, link.href);
        if (!target) continue;
        checkedLinks++;
        const reason = targetIssue(target);
        if (!reason) continue;
        const issue = { repo, source: relative, href: link.href, reason };
        (target.error || !baselineBroken.has(targetKey(target)) ? failures : existingBrokenLinks).push(issue);
      }
    } catch (error) { failures.push({ repo, source: relative, reason: error.message }); }
  }
  const names = cp.execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.md'], { cwd: roots.get(repo) }).toString().split('\0').filter(Boolean);
  const explicit = new Map((manifest.exclusions || []).filter(entry => entry.source).map(entry => [entry.source, entry.reason]));
  const covered = new Set(manifest.documents.flatMap(entry => [entry.source, ...Object.values(entry.languageOrigins || {})]));
  for (const filename of new Set(names)) {
    let excluded;
    if (/^docs\/i18n\//i.test(filename)) excluded = 'generated_language_editions_and_navigation';
    else if (/(?:^|\/)(?:AGENTS|CLAUDE)\.md$/i.test(filename) || /(?:^|\/)(?:\.kilo|\.agents|\.codex)(?:\/|$)/i.test(filename)) excluded = 'internal_agent_instructions';
    else if (/(?:^|\/)(?:\.git|node_modules|build|dist|local-builds|artifacts|vcpkg|third_party|vendor|deps)(?:\/|$)/i.test(filename) || /^release\//i.test(filename)) excluded = 'generated_or_third_party_tree';
    else if (explicit.has(filename)) excluded = explicit.get(filename);
    const complete = !/^docs\/i18n\//i.test(filename) && covered.has(filename);
    inventory.push({ repo, source: filename, status: complete ? 'covered' : excluded ? 'excluded' : 'missing', ...(!complete && excluded ? { reason: excluded } : {}) });
    if (!complete && !excluded) failures.push({ repo, source: filename, reason: 'first_party_markdown_missing_from_language_coverage' });
  }
}
const result = { ok: failures.length === 0, sourceDocuments: sourceCount, uniqueLanguageDocuments: languageFiles.size, checkedLinks, failures, existingBrokenLinks, warnings, inventory };
const output = option('--report', path.join(stage, 'validation.json'));
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(path.resolve(output), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, failures: failures.slice(0, 30), existingBrokenLinks: existingBrokenLinks.length, warnings: warnings.length, inventory: Object.fromEntries(['covered', 'excluded', 'missing'].map(status => [status, inventory.filter(entry => entry.status === status).length])) }, null, 2));
process.exitCode = result.ok ? 0 : 1;
