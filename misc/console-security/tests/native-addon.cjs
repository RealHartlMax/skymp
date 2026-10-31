// Opt-in native integration fixture. This does not launch Skyrim or a production server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { root, load } = require('./load-source.cjs');
const { MsgType } = load('skymp5-client/src/messages.ts');
const filename = process.argv[2];
assert(filename && path.isAbsolute(filename), 'Pass the explicitly built test addon path');
const { ScampServer } = require(filename);
const { ConsoleSecurityService } = load('skymp5-server/ts/consoleSecurity.ts');
const working = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-console-security-'));
assert(path.resolve(working).startsWith(path.resolve(os.tmpdir()) + path.sep));
process.chdir(working);
let assertions = 0;
const check = condition => { assert(condition); assertions++; };
try {
  const server = new ScampServer(JSON.stringify({ port: 0, listenHost: '127.0.0.1', maxPlayers: 4,
    dataDir: path.join(root, 'build/dist/server/data'), loadOrder: ['Skyrim.esm'], npcEnabled: false,
    itemsEnabled: false, logLevel: 'error', enableConsoleCommandsForAll: true,
    consoleSecurity: { mode: 'development', blockVanillaCheats: false } }));
  server._setSelf(server);
  const users = [], reports = [];
  server.on('connect', user => users.push(user));
  const bot = server.createBot(); server.tick();
  check(users.length === 1);
  check(server.getConsoleSecurityState(users[0]).authenticated === false);
  const actor = server.createActor(0, [0, 0, 0], 0, 0x3c);
  server.setUserActor(users[0], actor);
  const state = server.getConsoleSecurityState(users[0]);
  check(state.authenticated === true);
  check(state.policy.mode === 'development' && state.policy.blockVanillaCheats === false);
  check(state.policy.blockUnauthorizedServerCommands === true);
  check(state.diagnostics.includes('LEGACY_CONSOLE_BYPASS_IGNORED'));
  check(state.allowedServerCommands.length === 0);
  const inventory = () => JSON.stringify(server.get(actor, 'inventory'));
  const initial = inventory();
  const command = (commandName, args) => { bot.send({ t: MsgType.ConsoleCommand, data: { commandName, args } }); server.tick(); };
  command('additem', [0x14, 0x12eb7, 1]);
  check(inventory() === initial);
  server.set(actor, 'consoleCommandsAllowed', true);
  check(server.getConsoleSecurityState(users[0]).allowedServerCommands.length === 4);
  command('additem', [0x14, 0x12eb7, -1]);
  command('tgm', [0x14]);
  command('mp', [0x14, 'unknown']);
  command('additem', [0x14, 0x12eb7, 1000001]);
  check(inventory() === initial);
  server.setConsoleCommandAuthorizer(context => {
    check(context.userId === users[0] && context.actorId === actor);
    check(context.source === 'native_console');
    return context.permission === 'console.additem';
  });
  assert.deepEqual(server.getConsoleSecurityState(users[0]).allowedServerCommands, ['additem']); assertions++;
  command('additem', [0x14, 0x12eb7, 1]);
  check(inventory() !== initial);
  server.setConsoleCommandAuthorizer(() => { throw Error('fixture provider failure'); });
  check(server.getConsoleSecurityState(users[0]).allowedServerCommands.length === 0);
  server.setConsoleCommandAuthorizer(() => Promise.resolve(true));
  check(server.getConsoleSecurityState(users[0]).allowedServerCommands.length === 0);
  server.setConsoleCommandAuthorizer(null);
  check(server.getConsoleSecurityState(users[0]).allowedServerCommands.length === 4);
  for (const amount of [-1, 30001, 0.5, NaN, Infinity, '500']) {
    assert.throws(() => server.grantMovementAllowance(actor, amount)); assertions++;
  }
  assert.throws(() => server.grantMovementAllowance(0x100000000, 1000)); assertions++;
  server.grantMovementAllowance(actor, 1000); server.grantMovementAllowance(actor, 0);
  const send = server.sendCustomPacket.bind(server);
  Object.defineProperty(server, 'sendCustomPacket', { value: (user, raw) => { reports.push({ user, ...JSON.parse(raw) }); send(user, raw); } });
  const core = new ConsoleSecurityService(server, {});
  check(globalThis.skympChat === undefined);
  check(core.status().nativeSupported === true);
  bot.send({ t: MsgType.CustomPacket, contentJsonDump: JSON.stringify({ customPacketType: 'consoleSecurity:hello', apiVersion: 1, requestId: 'native_fixture', actorId: 42, admin: true }) });
  server.tick();
  check(reports.length === 1 && reports[0].user === users[0]);
  check(reports[0].requestId === 'native_fixture' && reports[0].policy.mode === 'development');
  check(reports[0].allowedServerCommands.length === 4);
  console.log(JSON.stringify({ ok: true, assertions, nativeAddon: filename, fixture: working,
    scope: 'Real native addon, mock transport, actual master records; no Chat dependency; no Skyrim/CEF or real-player acceptance' }));
  process.exit(0);
} catch (error) { console.error(error); process.exit(1); }
