#!/usr/bin/env node
// Documentation-only integration. External repositories are staged, never written.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const md = require('./markdown.cjs');
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const root = path.resolve(option('--root', path.join(__dirname, '../..')));
const workspace = path.dirname(root);
const integration = path.join(root, option('--stage', 'build/docs-translation/integration'));
const languages = ['de', 'en', 'ru'];
const names = { de: 'Deutsch', en: 'English', ru: 'Русский' };
const repositoryNames = ['skymp', 'skymp-client-launcher', 'SkyMP-Metabolism', 'SkyMP-Chat', 'SkyMP-UI-Core', 'SkyMP-YACA-TS', 'SkyMP-Character-Creator'];
const aliases = { core: 'skymp', launcher: 'skymp-client-launcher' };
const repoName = value => aliases[value] || value || 'skymp';
const key = (repo, relative) => repo + ':' + relative.toLowerCase();
const json = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
const serialize = value => JSON.stringify(value, null, 2) + '\n';
const statePath = path.join(integration, 'state.json');
const previous = fs.existsSync(statePath) ? json(statePath) : { files: [] };
const previousFiles = new Map(previous.files.map(file => [key(file.repo, file.path), file]));
const roots = new Map(repositoryNames.map(repo => [repo, repo === 'skymp' ? root : path.join(workspace, repo)]));
const upstream = new Map();
for (const scope of ['launcher', 'plugins']) {
  const base = path.join(root, 'build/docs-source-work-20261029', scope);
  const filename = path.join(base, 'changes.json');
  if (!fs.existsSync(filename)) continue;
  for (const file of json(filename).files) {
    const repo = repoName(file.repo);
    upstream.set(key(repo, file.path), { ...file, repo, base, scope });
  }
}
function safe(relative) {
  assert(relative && !path.isAbsolute(relative) && !relative.split(/[\\/]/).some(part => part === '..' || part === ''), 'Unsafe documentation path: ' + relative);
  assert(relative.endsWith('.md') || relative === 'docs/i18n/manifest.json', 'Integration may only write Markdown and docs/i18n/manifest.json: ' + relative);
  return relative;
}
function actual(repo, relative) {
  const filename = path.join(roots.get(repo), relative);
  return fs.existsSync(filename) ? fs.readFileSync(filename) : null;
}
const effective = new Map();
function read(repo, relative) {
  const id = key(repo, relative);
  if (effective.has(id)) return effective.get(id);
  const bytes = actual(repo, relative), digest = bytes ? md.sha(bytes) : null;
  const staged = upstream.get(id), old = previousFiles.get(id);
  let result = { bytes, dependency: null };
  if (staged) {
    if (digest === staged.after || digest === old?.after) result = { bytes, dependency: null };
    else if (digest === staged.before) {
      const filename = path.join(staged.base, 'after', staged.repo === 'skymp' ? 'core' : staged.repo === 'skymp-client-launcher' ? 'launcher' : staged.repo, relative);
      const stagedBytes = fs.readFileSync(filename);
      assert.equal(md.sha(stagedBytes), staged.after, 'Upstream staged bytes changed: ' + id);
      result = { bytes: stagedBytes, dependency: staged.scope + '/changes.json' };
    } else throw new Error('Unexpected upstream documentation change: ' + id);
  }
  effective.set(id, result);
  return result;
}
function required(repo, relative) {
  const result = read(repo, relative);
  assert(result.bytes, 'Missing full document: ' + repo + '/' + relative);
  return result.bytes.toString('utf8');
}
const inputs = [
  'build/docs-translation/core-coverage.json',
  'build/docs-source-work-20261029/launcher/coverage.json',
  'build/docs-source-work-20261029/plugins/coverage.json',
  'build/docs-source-work-20261029/roadmaps/coverage.json',
  'build/docs-translation/root-coverage.json'
];
for (let index = 0; index < args.length; index++) if (args[index] === '--input') inputs.push(args[++index]);
if (args.includes('--help')) {
  console.log('node misc/documentation/integrate.cjs [--root <core>] [--stage <relative staging directory>] [--input <additional coverage.json>] [--only <repository>] [--check-only] [--stage-core]');
  console.log('Writes core documentation directly; stages other repositories. Apply upstream translation changes before integration/changes.json. Rerun after adding completed entries to root-coverage.json.');
  process.exit(0);
}
const documents = new Map(), exclusions = [];
for (const input of inputs) {
  const filename = path.resolve(root, input), value = json(filename);
  for (const source of value.documents || value.files) {
    const repo = repoName(source.repo), id = key(repo, source.source);
    assert(roots.has(repo), 'Unknown repository: ' + repo);
    assert(!documents.has(id), 'Duplicate coverage source: ' + id);
    const original = md.stripNavigation(required(repo, source.source));
    assert.equal(md.sha(original), source.sourceSha256, 'Source changed beyond integration navigation: ' + id);
    for (const language of languages) assert(source.languages?.[language], 'Missing full language coverage: ' + id + ' ' + language);
    const output = Object.fromEntries(languages.map(language => [language, source.languages[language].startsWith('docs/i18n/' + language + '/') ? source.languages[language] : 'docs/i18n/' + language + '/' + source.languages[language]]));
    documents.set(id, { ...source, repo, scopeManifest: input, original, languageOrigins: { ...source.languages }, languages: output });
  }
  for (const excluded of value.exclusions || []) exclusions.push(typeof excluded === 'string' ? { scope: input, reason: excluded } : { ...excluded, repo: repoName(excluded.repo) });
}
const byRepo = new Map(repositoryNames.map(repo => [repo, [...documents.values()].filter(entry => entry.repo === repo).sort((a, b) => a.source.localeCompare(b.source, 'en'))]));
const fileMap = new Map(), outputMap = new Map();
function register(repo, relative, languagePaths) {
  const id = key(repo, relative), old = fileMap.get(id);
  if (old) assert.deepEqual(old.languages, languagePaths, 'Conflicting translated aliases: ' + id);
  else fileMap.set(id, { repo, languages: languagePaths });
}
for (const entry of documents.values()) {
  register(entry.repo, entry.source, entry.languages);
  for (const language of languages) {
    register(entry.repo, entry.languageOrigins[language], entry.languages);
    register(entry.repo, entry.languages[language], entry.languages);
    const id = key(entry.repo, entry.languages[language]), existing = outputMap.get(id);
    if (existing) assert.equal(existing.origin, entry.languageOrigins[language], 'Conflicting output origins: ' + id);
    else outputMap.set(id, { repo: entry.repo, path: entry.languages[language], language, origin: entry.languageOrigins[language], canonical: entry.source, entries: [] });
    outputMap.get(id).entries.push(entry);
  }
}
function located(filename) {
  for (const [repo, repositoryRoot] of roots) {
    const relative = md.slash(path.relative(repositoryRoot, filename));
    if (relative && relative !== '..' && !relative.startsWith('../') && !path.isAbsolute(relative)) return { repo, relative };
  }
  return null;
}
const planned = new Map();
function put(repo, relative, value, kind) {
  safe(relative);
  const id = key(repo, relative), prior = planned.get(id);
  assert(!prior || prior.text === value, 'Conflicting planned document: ' + id);
  planned.set(id, { repo, path: relative, text: value, kind });
}
function available(repo, relative) {
  return planned.has(key(repo, relative)) || outputMap.has(key(repo, relative)) || Boolean(read(repo, relative).bytes);
}
const rebased = [];
const anchorAliases = [];
function preserveAnchors(output, content) {
  const translated = md.headings(content), present = md.anchors(content), additions = new Map();
  const numbered = heading => /^\d+(?:\.\d+)*[.)]/.exec(heading.text)?.[0].replace(/[.)]$/, '');
  for (const entry of output.entries) {
    const original = md.headings(entry.original);
    const parallel = original.length === translated.length && original.every((heading, index) => heading.level === translated[index].level);
    for (let index = 0; index < original.length; index++) {
      const heading = original[index];
      if (present.has(heading.id)) continue;
      let target = parallel ? translated[index] : null;
      if (!target && numbered(heading)) {
        const candidates = translated.filter(value => value.level === heading.level && numbered(value) === numbered(heading));
        if (candidates.length === 1 && original.filter(value => value.level === heading.level && numbered(value) === numbered(heading)).length === 1) target = candidates[0];
      }
      if (!target) continue;
      if (!additions.has(target.offset)) additions.set(target.offset, []);
      additions.get(target.offset).push(heading.id); present.add(heading.id);
      anchorAliases.push({ repo: output.repo, path: output.path, id: heading.id, heading: target.text, alignment: parallel ? 'matching-heading-structure' : 'matching-unique-step-number' });
    }
  }
  return md.applyEdits(content, [...additions].map(([offset, ids]) => ({ start: offset, end: offset, value: ids.map(id => '<a id="' + id + '"></a>\n\n').join('') })));
}
function rebase(output, content) {
  const repositoryRoot = roots.get(output.repo), filename = path.join(repositoryRoot, output.path);
  const canonicalOrigin = output.origin.startsWith('docs/i18n/') ? output.canonical : output.origin;
  const origin = path.join(repositoryRoot, canonicalOrigin);
  const edits = [];
  for (const link of md.links(content)) {
    const parsed = md.parseHref(link.href);
    if (!parsed || parsed.error || !parsed.filename || parsed.filename.startsWith('/') && !/^[a-z]:/i.test(parsed.filename)) continue;
    const current = located(path.resolve(path.dirname(filename), parsed.filename));
    const canonical = located(path.resolve(path.dirname(origin), parsed.filename));
    let resolved;
    if (current && fileMap.has(key(current.repo, current.relative))) resolved = current;
    else if (canonical && fileMap.has(key(canonical.repo, canonical.relative))) resolved = canonical;
    else if (current && available(current.repo, current.relative) && !current.relative.startsWith('docs/i18n/')) resolved = current;
    else resolved = canonical || current;
    if (!resolved) continue;
    const group = fileMap.get(key(resolved.repo, resolved.relative));
    const switchLanguage = Object.keys(names).find(language => link.label === names[language]);
    const target = group ? group.languages[switchLanguage || output.language] : resolved.relative;
    const value = md.relativeHref(filename, path.join(roots.get(resolved.repo), target), parsed.query + parsed.hash);
    if (value !== link.href) {
      edits.push({ start: link.start, end: link.end, value });
      rebased.push({ repo: output.repo, path: output.path, from: link.href, to: value });
    }
  }
  const result = md.applyEdits(content, edits);
  assert.deepEqual(md.spans(result).map(span => span.value), md.spans(content).map(span => span.value), 'Code bytes changed during link rebasing: ' + output.path);
  return result;
}
function navigation(repo, relative, paths, language) {
  const filename = path.join(roots.get(repo), relative);
  const switcher = languages.map(value => '[' + names[value] + '](' + md.relativeHref(filename, path.join(roots.get(repo), paths[value])) + ')').join(' · ');
  const label = language === 'de' ? 'Dokumentationsübersicht' : language === 'ru' ? 'Указатель документации' : language === 'en' ? 'Documentation index' : 'Dokumentation / Documentation / Документация';
  const target = language ? 'docs/i18n/' + language + '/INDEX.md' : 'docs/i18n/README.md';
  return switcher + '\n\n[' + label + '](' + md.relativeHref(filename, path.join(roots.get(repo), target)) + ')';
}
for (const output of outputMap.values()) {
  const entry = output.entries[0], original = md.stripNavigation(required(output.repo, output.origin));
  const transformed = preserveAnchors(output, rebase(output, original));
  put(output.repo, output.path, md.addNavigation(transformed, navigation(output.repo, output.path, entry.languages, output.language)), output.origin === output.path ? 'translation-links-and-navigation' : 'native-language-mirror');
}
const sourceRefreshes = [];
for (const entry of documents.values()) {
  const text = md.addNavigation(entry.original, navigation(entry.repo, entry.source, entry.languages));
  assert.equal(md.sha(md.stripNavigation(text)), entry.sourceSha256, 'Original body changed: ' + entry.source);
  put(entry.repo, entry.source, text, 'source-navigation-only');
  sourceRefreshes.push({ repo: entry.repo, source: entry.source, translationSourceSha256: entry.sourceSha256, sourceSha256: md.sha(text), sourceBodySha256: md.sha(entry.original), navigationOnly: true });
}
// Existing native DE/EN/RU files can share a single canonical coverage topic.
// They also receive a gateway footer, without becoming extra translated topics.
for (const entry of documents.values()) {
  for (const origin of Object.values(entry.languageOrigins)) {
    if (origin.startsWith('docs/i18n/') || planned.has(key(entry.repo, origin))) continue;
    const original = md.stripNavigation(required(entry.repo, origin));
    const text = md.addNavigation(original, navigation(entry.repo, origin, entry.languages));
    put(entry.repo, origin, text, 'existing-language-source-navigation-only');
    sourceRefreshes.push({ repo: entry.repo, source: origin, originOf: entry.source, translationSourceSha256: md.sha(original), sourceSha256: md.sha(text), sourceBodySha256: md.sha(original), navigationOnly: true });
  }
}
const labels = {
  de: { title: 'Dokumentationsübersicht', intro: 'Vollständige deutsche Fassungen der erfassten Projektdokumente. Die Sprachlinks in jedem Dokument führen zur entsprechenden vollständigen Fassung.', back: 'Sprachauswahl', source: 'Originaldateien', exclusions: 'Abgrenzung' },
  en: { title: 'Documentation index', intro: 'Complete English editions of the covered project documents. Each document links to the corresponding complete edition in the other languages.', back: 'Language selection', source: 'Original files', exclusions: 'Scope exclusions' },
  ru: { title: 'Указатель документации', intro: 'Полные русские версии учтённых документов проекта. Ссылки выбора языка в каждом документе ведут к соответствующей полной версии.', back: 'Выбор языка', source: 'Исходные файлы', exclusions: 'Границы охвата' }
};
for (const [repo, entries] of byRepo) {
  if (!entries.length) continue;
  const groups = new Map();
  for (const entry of entries) {
    const id = languages.map(language => entry.languages[language]).join('|');
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(entry);
  }
  for (const language of languages) {
    const relative = 'docs/i18n/' + language + '/INDEX.md', filename = path.join(roots.get(repo), relative), words = labels[language];
    let text = '# ' + repo + ' — ' + words.title + '\n\n' + words.intro + '\n\n';
    text += '[Deutsch](../de/INDEX.md) · [English](../en/INDEX.md) · [Русский](../ru/INDEX.md)\n\n';
    text += '[' + words.back + '](../README.md)\n\n';
    for (const family of groups.values()) {
      const target = family[0].languages[language], body = planned.get(key(repo, target)).text;
      const title = md.headings(body).find(heading => heading.level === 1)?.text || target;
      text += '- [' + title.replace(/\[/g, '\\[').replace(/\]/g, '\\]') + '](' + md.relativeHref(filename, path.join(roots.get(repo), target)) + ') — ' + family.map(entry => '`' + entry.source + '`').join(', ') + '\n';
    }
    const omitted = exclusions.filter(entry => !entry.repo || entry.repo === repo);
    if (omitted.length) {
      text += '\n## ' + words.exclusions + '\n\n';
      text += language === 'de' ? 'Nicht enthalten sind fremde Abhängigkeiten, generierte Dateien und interne Agentenanweisungen. Einzelne ausdrücklich ausgeschlossene Dateien sind im [Abdeckungsmanifest](../manifest.json) aufgeführt.\n' : language === 'ru' ? 'Не включены сторонние зависимости, сгенерированные файлы и внутренние инструкции агентам. Явно исключённые файлы перечислены в [манифесте охвата](../manifest.json).\n' : 'Third-party dependencies, generated files and internal agent instructions are excluded. Explicit file exclusions are recorded in the [coverage manifest](../manifest.json).\n';
    }
    put(repo, relative, text, 'language-index');
  }
  put(repo, 'docs/i18n/README.md', '# ' + repo + ' — Dokumentation / Documentation / Документация\n\n' +
    '- [Deutsch: vollständige Dokumentation](de/INDEX.md)\n' +
    '- [English: complete documentation](en/INDEX.md)\n' +
    '- [Русский: полная документация](ru/INDEX.md)\n\n' +
    'Die Übersichten verlinken vollständige Sprachfassungen; die bisherigen Originaldateien bleiben erhalten. Dokumentierte Quellcode- und lokale Prüfergebnisse belegen keine ungeprüfte Abnahme in Skyrim/CEF, TeamSpeak oder auf einem VPS.\n\n' +
    'The indexes link complete language editions; existing original files are retained. Documented source and local checks do not establish unperformed acceptance in Skyrim/CEF, TeamSpeak or on a VPS.\n\n' +
    'Указатели ведут к полным языковым версиям; существующие исходные файлы сохранены. Проверки исходного кода и локальные тесты не подтверждают непроведённую приёмку в Skyrim/CEF, TeamSpeak или на VPS.\n\n' +
    '[Abdeckungsmanifest / Coverage manifest / Манифест охвата](manifest.json)\n', 'language-gateway');
  const publicEntries = entries.map(entry => {
    const refresh = sourceRefreshes.find(item => item.repo === repo && item.source === entry.source);
    const result = { source: entry.source, sourceLanguage: entry.sourceLanguage, sourceSha256: refresh.sourceSha256, translationSourceSha256: entry.sourceSha256, sourceBodySha256: refresh.sourceBodySha256, languageOrigins: entry.languageOrigins, languages: entry.languages, outputs: {} };
    for (const language of languages) result.outputs[language] = { sha256: md.sha(planned.get(key(repo, entry.languages[language])).text), ...(entry.outputs?.[language]?.translatedBlocks !== undefined ? { translatedBlocks: entry.outputs[language].translatedBlocks } : {}) };
    if (entry.omittedDuplicateBlocks) result.omittedDuplicateBlocks = entry.omittedDuplicateBlocks;
    if (entry.rebasedFrom) result.rebasedFrom = entry.rebasedFrom;
    return result;
  });
  put(repo, 'docs/i18n/manifest.json', serialize({ schemaVersion: 1, repository: repo, languages, documents: publicEntries, exclusions: exclusions.filter(entry => !entry.repo || entry.repo === repo), navigation: { gateway: 'docs/i18n/README.md', indexes: Object.fromEntries(languages.map(language => [language, 'docs/i18n/' + language + '/INDEX.md'])) } }), 'coverage-manifest');
}
// Preflight all bytes before any write, including dependency hashes for staged repos.
const selected = [...planned.values()].filter(file => !option('--only', null) || file.repo === repoName(option('--only')));
const changed = [], known = [];
for (const file of selected) {
  const original = read(file.repo, file.path), digest = original.bytes ? md.sha(original.bytes) : null;
  const after = md.sha(file.text), realBytes = actual(file.repo, file.path);
  known.push({ repo: file.repo, path: file.path, after, kind: file.kind });
  if (digest === after) continue;
  changed.push({ repo: file.repo, path: file.path, before: digest, after, actualAtPlan: realBytes ? md.sha(realBytes) : null, kind: file.kind, ...(original.dependency ? { dependsOn: original.dependency } : {}) });
}
if (args.includes('--check-only')) {
  console.log(serialize({ checkedSources: documents.size, plannedFiles: selected.length, changedFiles: changed.length, sourceBodiesUnchanged: true }));
  process.exit(0);
}
fs.mkdirSync(integration, { recursive: true });
for (const file of changed) {
  const value = planned.get(key(file.repo, file.path)).text;
  const baseline = read(file.repo, file.path).bytes;
  if (baseline) {
    const backup = path.join(integration, 'before', file.repo, file.path);
    if (!fs.existsSync(backup)) { fs.mkdirSync(path.dirname(backup), { recursive: true }); fs.writeFileSync(backup, baseline); }
  }
  const filename = file.repo === 'skymp' && !args.includes('--stage-core') ? path.join(root, file.path) : path.join(integration, 'after', file.repo, file.path);
  if (file.repo === 'skymp' && !args.includes('--stage-core')) {
    const current = actual(file.repo, file.path);
    assert.equal(current ? md.sha(current) : null, file.actualAtPlan, 'Concurrent documentation change before write: ' + file.path);
  }
  fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(filename, value);
}
const oldUnselected = previous.files.filter(file => option('--only', null) && file.repo !== repoName(option('--only')));
fs.writeFileSync(statePath, serialize({ files: [...oldUnselected, ...known], sourceHashRefreshes: sourceRefreshes }));
fs.writeFileSync(path.join(integration, 'changes.json'), serialize({ stageCore: args.includes('--stage-core'), applyAfter: ['build/docs-source-work-20261029/launcher/changes.json', 'build/docs-source-work-20261029/plugins/changes.json'], files: changed.filter(file => file.repo !== 'skymp' || args.includes('--stage-core')) }));
fs.writeFileSync(path.join(integration, 'core-changes.json'), serialize({ files: changed.filter(file => file.repo === 'skymp') }));
fs.writeFileSync(path.join(integration, 'source-navigation-audit.json'), serialize(sourceRefreshes));
fs.writeFileSync(path.join(integration, 'link-rebases.json'), serialize(rebased));
fs.writeFileSync(path.join(integration, 'anchor-aliases.json'), serialize(anchorAliases));
const summary = { sourceDocuments: documents.size, repositories: Object.fromEntries([...byRepo].map(([repo, entries]) => [repo, { sources: entries.length, languageFiles: new Set(entries.flatMap(entry => Object.values(entry.languages))).size }])), changedCoreFiles: changed.filter(file => file.repo === 'skymp').length, stagedExternalFiles: changed.filter(file => file.repo !== 'skymp').length, rebasedLinks: rebased.length, sourceBodiesUnchanged: true };
fs.writeFileSync(path.join(integration, 'summary.json'), serialize(summary));
console.log(serialize(summary));
