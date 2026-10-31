#!/usr/bin/env node
// Read-only documentation coverage check; no application build or package output.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const options = process.argv.slice(2);
const option = (name, fallback) => { const index = options.indexOf(name); return index < 0 ? fallback : options[index + 1]; };
const root = path.resolve(option('--root', path.join(__dirname, '../..')));
const manifestPath = path.resolve(root, option('--manifest', 'docs/i18n/manifest.json'));
const languages = ['de', 'en', 'ru'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const normalize = value => value.replace(/\r\n/g, '\n');
const read = relative => fs.readFileSync(path.resolve(root, relative), 'utf8');
function fences(text) {
  const result = [], lines = normalize(text).split('\n');
  let marker = null, block = [];
  for (const line of lines) {
    if (!marker) {
      const match = /^\s*(`{3,}|~{3,})/.exec(line);
      if (match) { marker = match[1]; block = [line]; }
    } else {
      block.push(line);
      if (new RegExp('^\\s*' + marker[0] + '{' + marker.length + ',}\\s*$').test(line)) { result.push(block.join('\n')); marker = null; }
    }
  }
  assert(!marker, 'Unclosed fenced code block');
  return result;
}
function withoutCode(text) {
  return normalize(text).replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, '').replace(/`[^`\n]*`/g, '');
}
function links(text) {
  const result = [], content = withoutCode(text);
  for (const match of content.matchAll(/!?\[[^\]\n]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+["'][^\n]*?["'])?\s*\)/g)) result.push(match[1].replace(/^<|>$/g, ''));
  for (const match of content.matchAll(/^\s*\[[^\]]+\]:\s*(<[^>]+>|[^\s]+)(?:\s+["'][^\n]*?["'])?\s*$/gm)) result.push(match[1].replace(/^<|>$/g, ''));
  return result;
}
const existence = new Map();
function exists(filename) {
  if (!existence.has(filename)) existence.set(filename, fs.existsSync(filename));
  return existence.get(filename);
}
function localTarget(source, href) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i.test(href)) return null;
  let target = href.split('#')[0].split('?')[0];
  try { target = decodeURIComponent(target); } catch { return { error: 'invalid_url_encoding' }; }
  return { filename: target ? path.resolve(root, path.dirname(source), target) : path.resolve(root, source) };
}

function verify() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const documents = manifest.documents ?? manifest.files;
  assert(Array.isArray(documents), 'Manifest requires documents');
  const failures = [], existingBrokenLinks = [], sourceSet = new Set();
  let translations = 0, checkedLinks = 0;
  for (const entry of documents) {
    try {
      assert(!sourceSet.has(entry.source), 'Duplicate source in coverage'); sourceSet.add(entry.source);
      assert(typeof entry.source === 'string' && !path.isAbsolute(entry.source) && !entry.source.split(/[\\/]/).includes('..'), 'Invalid source path');
      const sourceBytes = fs.readFileSync(path.resolve(root, entry.source)), source = sourceBytes.toString('utf8');
      assert.equal(hash(sourceBytes), entry.sourceSha256, 'Source changed after translation');
      const sourceFences = fences(source);
      const originalMissing = new Set(links(source).map(href => localTarget(entry.source, href)).filter(target => target?.filename && !exists(target.filename)).map(target => target.filename));
      const outputPaths = languages.map(language => entry.languages?.[language]);
      assert(outputPaths.every(value => typeof value === 'string'), 'Missing requested language');
      assert.equal(new Set(outputPaths).size, 3, 'Each language requires its own full language document');
      for (const language of languages) {
        const outputPath = entry.languages[language];
        assert(!path.isAbsolute(outputPath) && !outputPath.split(/[\\/]/).includes('..'), 'Invalid output path');
        const output = read(outputPath);
        assert(output.trim().length > 0, 'Empty language document');
        assert(!/\b(?:TODO_TRANSLATE|TRANSLATION_PENDING|PLACEHOLDER_TRANSLATION)\b/.test(output), 'Unfinished translation marker');
        if (outputPath.includes('/i18n/')) {
          assert.deepEqual(fences(output), sourceFences, 'Code fences differ from canonical source');
          if (entry.outputs?.[language]?.sha256) assert.equal(hash(Buffer.from(output)), entry.outputs[language].sha256, 'Translation changed after recorded validation');
        }
        for (const href of links(output)) {
          const target = localTarget(outputPath, href); if (!target) continue;
          checkedLinks++;
          if (target.error) { failures.push({ source: entry.source, language, href, reason: target.error }); continue; }
          if (!exists(target.filename)) {
            // Keep historical broken source links visible without attributing them to translation.
            let canonical = path.relative(root, target.filename).split(path.sep).join('/').replace(/^docs\/i18n\/(?:de|en|ru)\//, '');
            canonical = path.resolve(root, canonical);
            const issue = { source: entry.source, language, href, reason: 'missing_local_target' };
            (originalMissing.has(target.filename) || originalMissing.has(canonical) ? existingBrokenLinks : failures).push(issue);
          }
        }
        translations++;
      }
    } catch (error) { failures.push({ source: entry.source, reason: error.message }); }
  }
  const result = { ok: failures.length === 0, root, documents: documents.length, languageDocuments: translations, checkedLinks, exclusions: manifest.exclusions ?? [], failures, existingBrokenLinks };
  const report = option('--report', null);
  if (report) fs.writeFileSync(path.resolve(report), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ ...result, failures: failures.slice(0, 20), existingBrokenLinks: existingBrokenLinks.length }));
  return result.ok;
}
try { process.exitCode = verify() ? 0 : 1; } catch (error) { console.error(error.message); process.exitCode = 1; }
