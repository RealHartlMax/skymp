#!/usr/bin/env node
// Package the CI native build with the same first-run runtime as local releases.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
function git(args) {
  const result = spawnSync('git', ['--no-optional-locks', ...args], { cwd: root, maxBuffer: 256 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr?.toString() || result.error?.message);
  return result.stdout;
}
function packageCiServer({ platform, version, source, output, readGit = git }) {
  assert(['linux-x64', 'windows-x64'].includes(platform), 'Unsupported platform');
  assert(/^v\d+\.\d+\.\d+$/.test(version), 'Expected semantic release tag');
  source = path.resolve(source); output = path.resolve(output);
  assert(!fs.existsSync(output), 'Refusing to overwrite a CI package');
  assert.notEqual(source, output);
  assert(!output.startsWith(source + path.sep), 'CI package must be outside the native input');
  assert(!readGit(['status', '--porcelain', '--untracked-files=no']).toString().trim(), 'CI source has tracked modifications; refuse a misleading source archive');
  const commit = readGit(['rev-parse', 'HEAD']).toString().trim();
  assert(/^[a-f0-9]{40}$/.test(commit), 'Invalid source commit');
  const archive = readGit(['archive', '--format=tar.gz', 'HEAD']);
  const buildId = 'skymp-server-' + version;
  const sourceArchiveName = `${buildId}-${platform}-source.tar.gz`;
  const metadata = {
    buildId, version, sourceCommit: commit, sourceFingerprint: crypto.createHash('sha256').update(archive).digest('hex'),
    builtAt: new Date().toISOString(), sourceDirty: false, source: 'github-actions', sourceArchiveName,
  };
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, sourceArchiveName), archive);
  const metadataFile = path.join(output, 'build-metadata.json');
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2) + '\n');
  const target = path.join(output, 'dist/server');
  const result = spawnSync(process.execPath, [path.join(__dirname, 'package_test_server.cjs'), '--mode', 'first-run', '--platform', platform, '--source', source, '--scripts', path.join(source, 'data/scripts'), '--output', target, '--metadata', metadataFile], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr || result.error?.message || result.stdout);
  return { ok: true, output: target, sourceArchive: path.join(output, sourceArchiveName), metadata };
}
if (require.main === module) {
  const options = {};
  for (let i = 2; i < process.argv.length; i += 2) options[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
  console.log(JSON.stringify(packageCiServer(options), null, 2));
}
module.exports = { packageCiServer };
