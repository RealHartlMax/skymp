// Exercise the real console-capture function without loading the native server.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ts = require('../node_modules/typescript');
const sourcePath = fileURLToPath(new URL('../ts/index.ts', import.meta.url));
const source = fs.readFileSync(sourcePath, 'utf8');
const syntax = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true);
const declaration = syntax.statements.find(node => ts.isVariableStatement(node)
  && node.declarationList.declarations.some(value => value.name.getText(syntax) === 'setupStreams'));
assert(declaration);
const code = ts.transpileModule(declaration.getText(syntax), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-console-test-'));
const output = [], captured = [], streams = [];
let callbacks = 0;
const originalWrite = level => (chunk, encoding, callback) => {
  output.push({ level, text: String(chunk) });
  const done = typeof encoding === 'function' ? encoding : callback;
  if (done) queueMicrotask(() => done());
  return false; // Backpressure must pass through unchanged.
};
const fakeProcess = { stdout: { write: originalWrite('info') }, stderr: { write: originalWrite('error') } };
try {
  const fsProxy = { ...fs, createWriteStream(...args) { const stream = fs.createWriteStream(...args); streams.push(stream); return stream; } };
  const setup = new Function('fs', 'path', 'process', 'ui', 'cleanupServerLogs', code + '\nreturn setupStreams;')(
    fsProxy, path, fakeProcess, { pushServerLogChunk: (level, text) => captured.push({ level, text }) }, () => {},
  );
  setup(root);
  assert.equal(fakeProcess.stdout.write('[plugins] known, startupEnabled=false\n'), false);
  assert.equal(fakeProcess.stdout.write(Buffer.from('Sprachprüfung ÄÖÜ\n'), () => callbacks++), false);
  assert.equal(fakeProcess.stderr.write('Failure fixture\n', 'utf8', () => callbacks++), false);
  await Promise.resolve();
  assert.equal(callbacks, 2);
  assert.equal(output.filter(value => value.text.includes('startupEnabled=false')).length, 1);
  assert.equal(output.filter(value => value.text.includes('Sprachprüfung')).length, 1);
  assert.equal(output.filter(value => value.text.includes('Failure fixture')).length, 1);
  assert.deepEqual(captured, [
    { level: 'info', text: '[plugins] known, startupEnabled=false\n' },
    { level: 'info', text: 'Sprachprüfung ÄÖÜ\n' },
    { level: 'error', text: 'Failure fixture\n' },
  ]);
  await Promise.all(streams.map(stream => new Promise(resolve => stream.end(resolve))));
  const log = fs.readFileSync(path.join(root, fs.readdirSync(root)[0]), 'utf8');
  assert.equal(log.split('startupEnabled=false').length - 1, 1);
  assert(log.includes('[error] Failure fixture'));
  console.log(JSON.stringify({ ok: true, checks: ['Console output and JS logfile contain one copy', 'Info/error chunks remain available to the dashboard', 'Optional callbacks, UTF-8 buffers and backpressure are preserved'], nativeGameStarted: false }));
} finally {
  for (const stream of streams) if (!stream.closed) stream.destroy();
  assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
  assert(path.basename(root).startsWith('skymp-console-test-'));
  fs.rmSync(root, { recursive: true, force: true });
}
