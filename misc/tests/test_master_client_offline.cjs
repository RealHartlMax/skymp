const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'skymp5-server/node_modules/typescript'));
const source = fs.readFileSync(path.join(root, 'skymp5-server/ts/systems/masterClient.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

async function run() {
  const posts = [], hooks = [];
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    require(name) {
      if (name === 'axios') return { post: async (...args) => { posts.push(args); } };
      if (name === '../lib/axiosDefaults') return { DEFAULT_TIMEOUT_MS: 1000, MAX_REQUEST_BODY_BYTES: 10000, MAX_RESPONSE_BODY_BYTES: 10000 };
      throw new Error(`Unexpected runtime import: ${name}`);
    },
    process: { once: (name, callback) => hooks.push([name, callback]) },
    setTimeout: callback => callback(),
  });
  const { MasterClient } = module.exports;
  const make = (offline, master = 'http://master.invalid') =>
    new MasterClient(() => {}, 7777, '127.0.0.1', master, 16, 'Test', 'test-key', 15000, offline);

  const offline = make(true);
  await offline.initAsync();
  await offline.updateAsync({ svr: { get() { throw new Error('Offline mode must not query online players'); } } });
  assert.equal(posts.length, 0, 'Offline startup and updates must not publish a heartbeat');
  assert.equal(hooks.length, 0, 'Offline mode must not install shutdown heartbeat handlers');

  const unlisted = make(false, null);
  await unlisted.initAsync();
  assert.equal(posts.length, 0);

  const online = make(false);
  await online.initAsync();
  assert.equal(posts.length, 1);
  assert.equal(posts[0][0], 'http://master.invalid/api/servers/test-key');
  assert.equal(posts[0][1].online, 0);
  await online.updateAsync({ svr: { get: () => [1, 2] } });
  assert.equal(posts.length, 2);
  assert.equal(posts[1][1].online, 2);
  const shutdown = hooks.find(([name]) => name === 'SIGTERM');
  assert(shutdown);
  shutdown[1]();
  await Promise.resolve();
  assert.equal(posts.length, 3, 'Online shutdown heartbeat remains enabled');
  console.log('MasterClient: offline startup/update/shutdown isolation and online heartbeat regression checks passed.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
