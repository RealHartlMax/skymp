// Optional interop fixture. Execute the actual plugin bundle with a disposable
// server configuration, never a vendored plugin implementation or live server.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), os = require('node:os');
const { EventEmitter } = require('node:events');
function loadPluginFixture(pluginRoot, overrides = {}, localeOverrides) {
  if (!pluginRoot) throw Error('Specify the SkyMP Chat plugin source directory');
  const temp = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(temp, 'skymp-chat-interop-'));
  function cleanup() {
    if (!path.resolve(directory).startsWith(temp + path.sep)) throw Error('Fixture cleanup outside temp root');
    fs.rmSync(directory, { recursive: true, force: true });
  }
  const config = { ...JSON.parse(fs.readFileSync(path.join(pluginRoot, 'Plugins/SkyMPChat/config.json'))), ...overrides };
  fs.mkdirSync(path.join(directory, 'Plugins/SkyMPChat'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'Plugins/SkyMPChat/config.json'), JSON.stringify(config));
  const locales = path.join(pluginRoot, 'Plugins/SkyMPChat/locales');
  if (fs.existsSync(locales)) fs.cpSync(locales, path.join(directory, 'Plugins/SkyMPChat/locales'), { recursive: true });
  if (localeOverrides) {
    if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i.test(config.locale)) throw Error('Invalid locale fixture path');
    fs.mkdirSync(path.join(directory, 'Plugins/SkyMPChat/locales'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'Plugins/SkyMPChat/locales', config.locale.toLowerCase() + '.json'), JSON.stringify(localeOverrides));
  }
  const mp = new EventEmitter();
  const players = new Map([[0, { actorId: 101, name: 'Alice', world: 60, pos: [0, 0, 0] }], [1, { actorId: 102, name: 'Boris', world: 60, pos: [1, 0, 0] }]]);
  const playerByActor = actor => [...players.values()].find(player => player.actorId === actor);
  mp.isConnected = id => players.has(id);
  mp.getUserActor = id => players.get(id)?.actorId || 0;
  mp.getUserByActor = actor => [...players].find(([, player]) => player.actorId === actor)?.[0] ?? 65535;
  mp.getActorName = actor => playerByActor(actor)?.name;
  mp.getActorPos = actor => playerByActor(actor)?.pos;
  mp.getActorCellOrWorld = actor => playerByActor(actor)?.world;
  mp.lookupEspmRecordById = id => ({ record: { type: id === 60 || id === 61 ? 'WRLD' : id === 100 || id === 200 ? 'CELL' : 'UNKNOWN' } });
  mp.sendCustomPacket = () => {};
  const context = vm.createContext({ mp, require, process: { cwd: () => directory }, console, setTimeout, clearTimeout, AbortController });
  try {
    vm.runInContext(fs.readFileSync(path.join(pluginRoot, 'Plugins/SkyMPChat/index.cjs'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(pluginRoot, 'examples/SkyMPChatPing/index.cjs'), 'utf8'), context);
  } catch (error) { cleanup(); throw error; }
  let stopped = false;
  return { mp, players, config, chat: { api: context.skympChat, stop() {
    if (stopped) return;
    stopped = true;
    try { vm.runInContext("globalThis[Symbol.for('skymp-chat.runtime.v1')].runtime.stop()", context); }
    finally { cleanup(); }
  } } };
}
module.exports = { loadPluginFixture };
