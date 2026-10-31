#!/usr/bin/env node
// Writes docs/i18n/manifest.json from the translations on disk; verify.cjs then checks it.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const i18n = path.join(root, 'docs/i18n');
const languages = ['de', 'en', 'ru'];
const sha = filename => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const exists = relative => fs.existsSync(path.join(root, relative));
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? walk(path.join(dir, entry.name)) : entry.name.endsWith('.md') ? [path.join(dir, entry.name)] : []);

// Contributing guides are written twice by hand, so each original is the other's translation.
const contributing = {
  'How to create packet on the server.md': 'Как создать пакет на сервере.md',
  'How to release SP update.md': 'Как выпустить обновление SP.md',
  'How to send packet from client.md': 'Как отправить пакет с клиента.md',
  'How to work with skymp5-client.md': 'Как работать с skymp5-client.md',
  'How to work with skyrim-platform.md': 'Как работать с skyrim-platform.md',
};
function languageFile(source, language) {
  const translated = 'docs/i18n/' + language + '/' + source;
  if (exists(translated)) return translated;
  const sibling = source.replace(/\.md$/, '.' + language + '.md');
  if (exists(sibling)) return sibling;
  const name = path.posix.basename(source);
  if (language === 'ru' && contributing[name]) return 'docs/contributing/ru/' + contributing[name];
  return source;
}

const sources = new Set();
for (const language of languages)
  for (const file of walk(path.join(i18n, language)))
    sources.add(path.relative(path.join(i18n, language), file).split(path.sep).join('/'));

const documents = [], exclusions = [];
for (const source of [...sources].sort()) {
  if (!exists(source)) { exclusions.push({ source, reason: 'source_removed' }); continue; }
  const files = Object.fromEntries(languages.map(language => [language, languageFile(source, language)]));
  if (new Set(Object.values(files)).size !== languages.length) { exclusions.push({ source, reason: 'missing_language', files }); continue; }
  documents.push({ source, sourceSha256: sha(path.join(root, source)), languages: files });
}
const output = path.join(i18n, 'manifest.json');
fs.writeFileSync(output, JSON.stringify({ version: 1, languages, documents, exclusions }, null, 2) + '\n');
console.log(JSON.stringify({ documents: documents.length, exclusions }));
