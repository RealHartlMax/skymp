const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const sourceRoot = path.join(__dirname, '../src/services/services');
const transpile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleFixture = { exports: {} };
new Function('exports', transpile(fs.readFileSync(path.join(sourceRoot, 'playerSpawnLocation.ts'), 'utf8')))(moduleFixture.exports);
const { isAtSpawnLocation, restorePlayerSpawn } = moduleFixture.exports;
const target = { pos: [8000, 6000, 400], rot: [0, 0, 90], worldOrCell: 60 };
function player(position, location, interior = false) {
  return {
    getParentCell: () => ({ isInterior: () => interior, getFormID: () => location }),
    getWorldSpace: () => ({ getFormID: () => interior ? 60 : location }),
    getPositionX: () => position[0], getPositionY: () => position[1], getPositionZ: () => position[2],
  };
}

test('template-save location is replaced with the last server position after delayed native movement becomes available', async () => {
  let current = player([0, 0, 0], 777, true), waits = 0, attempts = 0;
  const moved = [];
  const restored = await restorePlayerSpawn(target, {
    isCurrent: () => true, getPlayer: () => current,
    movePlayer: value => { moved.push(value); if (++attempts >= 3) current = player(value.pos, value.worldOrCell); },
    wait: async () => { waits++; assert(waits < 10, 'Restoration did not complete'); },
    onError: error => { throw error; },
  });
  assert.equal(restored, true);
  assert.equal(attempts, 3);
  assert.equal(waits, 3);
  assert(moved.every(value => value === target));
  assert(isAtSpawnLocation(current, target));
});

test('restoration compares world/cell and vertical position, including interiors with a parent world', () => {
  assert.equal(isAtSpawnLocation(player(target.pos, 777, true), target), false);
  assert.equal(isAtSpawnLocation(player([8000, 6000, -900], 60), target), false);
  assert.equal(isAtSpawnLocation(player([NaN, 6000, 400], 60), target), false);
  assert.equal(isAtSpawnLocation(player(target.pos, 60), target), true);
  assert.equal(isAtSpawnLocation(player(target.pos, 777, true), { ...target, worldOrCell: 777 }), true);
});

test('missing player waits and a superseded connection cannot continue teleporting', async () => {
  let active = true, moves = 0;
  assert.equal(await restorePlayerSpawn(target, {
    isCurrent: () => active, getPlayer: () => null,
    movePlayer: () => moves++, wait: async () => { active = false; }, onError: () => assert.fail(),
  }), false);
  assert.equal(moves, 0);
  active = true;
  assert.equal(await restorePlayerSpawn(target, {
    isCurrent: () => active, getPlayer: () => player([0, 0, 0], 777, true),
    movePlayer: () => moves++, wait: async () => { active = false; }, onError: () => assert.fail(),
  }), false);
  assert.equal(moves, 1);
});

test('an already restored player is not moved again and transient native errors are retried without log spam', async () => {
  assert.equal(await restorePlayerSpawn(target, {
    isCurrent: () => true, getPlayer: () => player(target.pos, 60), movePlayer: () => assert.fail(),
    wait: async () => assert.fail(), onError: () => assert.fail(),
  }), true);
  let current = player([0, 0, 0], 777, true), attempts = 0;
  const errors = [];
  assert.equal(await restorePlayerSpawn(target, {
    isCurrent: () => true, getPlayer: () => current,
    movePlayer: () => { if (++attempts < 3) throw Error('Native move temporarily blocked'); current = player(target.pos, 60); },
    wait: async () => {}, onError: error => errors.push(String(error)),
  }), true);
  assert.equal(errors.length, 1);
});

test('actual movement service waits for restored location while other input can continue', () => {
  const file = path.join(sourceRoot, 'sendInputsService.ts'), source = fs.readFileSync(file, 'utf8');
  const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const declaration = syntax.statements.find(node => ts.isClassDeclaration(node) && node.name.text === 'SendInputsService');
  assert(declaration);
  const globals = syntax.statements.filter(node => ts.isVariableStatement(node)).map(node => node.getText(syntax)).join('\n');
  class ClientListener {} class RemoteServer {} class SinglePlayerService {}
  const Service = new Function('ClientListener', 'RemoteServer', 'SinglePlayerService', 'getMovement', 'MsgType',
    transpile(globals + '\n' + declaration.getText(syntax).replace(/^export /, '')) + '\nreturn SendInputsService;')(
    ClientListener, RemoteServer, SinglePlayerService, () => ({ ...target, runMode: 'Standing', speed: 0 }), { UpdateMovement: 2 });
  let spawning = true, sent = 0, playerReads = 0, otherInput = 0;
  const controller = { on() {}, emitter: { emit: () => sent++ }, lookupListener(type) {
    if (type === RemoteServer) return { isPlayerSpawning: () => spawning };
    if (type === SinglePlayerService) return { isSinglePlayer: false };
    assert.fail('Unexpected service');
  } };
  const service = new Service({ Game: { getPlayer() { playerReads++; return { getAnimationVariableBool: () => false }; } } }, controller);
  service.sendMovement(); assert.equal(sent, 0); assert.equal(playerReads, 0);
  service.sendInputs = () => otherInput++;
  service.onUpdate(); assert.equal(otherInput, 1); assert.equal(sent, 0);
  spawning = false;
  service.sendMovement(); assert.equal(sent, 1);
});

function remoteFixture() {
  const file = path.join(sourceRoot, 'remoteServer.ts'), source = fs.readFileSync(file, 'utf8');
  const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const declaration = syntax.statements.find(node => ts.isClassDeclaration(node) && node.name.text === 'RemoteServer');
  const storage = { worldModel: { forms: [], playerCharacterFormIdx: -1, playerCharacterRefrId: 0 }, idManager: { allocateIdFor: () => 0, getId: () => 0 } };
  const queues = { tick: [], update: [] }, waiters = [], errors = [], moves = [], loads = [];
  let currentPosition = [0, 0, 0], location = 777, interior = true, blockedMoves = 2;
  const reference = {
    getParentCell: () => ({ isInterior: () => interior, getFormID: () => location }),
    getWorldSpace: () => interior ? null : { getFormID: () => location },
    getPositionX: () => currentPosition[0], getPositionY: () => currentPosition[1], getPositionZ: () => currentPosition[2],
    getFormID: () => 0x14,
  };
  const Game = { getPlayer: () => reference, getFormEx: id => id, getModCount: () => 0 };
  const once = (event, fn) => queues[event].push(fn);
  class ClientListener {} class LoadGameService {} class TimeService {} class RagdollService {}
  const listeners = new Map();
  const controller = { emitter: { on: (event, fn) => listeners.set(event, fn), emit: (event, data) => listeners.get(event)?.(data) }, lookupListener(type) {
    if (type === LoadGameService) return { loadGame(...args) { loads.push(args); currentPosition = [0, 0, 0]; location = 777; interior = true; } };
    if (type === TimeService) return { getTime: () => ({ newGameHourValue: 12 }) };
    if (type === RagdollService) return { safeRemoveRagdollFromWorld: (_actor, callback) => callback() };
    assert.fail('Unexpected service dependency');
  } };
  const dependencies = { ClientListener, LoadGameService, TimeService, RagdollService, Game, storage, once, restorePlayerSpawn, isAtSpawnLocation,
    logTrace() {}, logError: (...args) => errors.push(args), MsgType: {},
    Actor: { from: value => value }, ObjectReference: { from: () => reference },
    Cell: { from: id => id === 60 ? null : id }, WorldSpace: { from: id => id === 60 ? id : null },
    Utility: { wait: () => new Promise(resolve => waiters.push(resolve)) },
    TESModPlatform: { moveRefrToPosition(_player, cell, world, ...values) {
      moves.push({ pos: values.slice(0, 3), worldOrCell: world || cell });
      if (blockedMoves-- > 0) return;
      currentPosition = values.slice(0, 3); location = world || cell; interior = !world;
    } },
  };
  const Service = new Function(...Object.keys(dependencies), transpile(declaration.getText(syntax).replace(/^export /, '')) + '\nreturn RemoteServer;')(...Object.values(dependencies));
  const service = new Service({ Game }, controller);
  const message = { isMe: true, idx: 0, refrId: 0xff000000, transform: structuredClone(target), props: {}, customPropsJsonDumps: [] };
  const step = event => { const work = queues[event].splice(0); work.forEach(fn => fn()); };
  const wait = async () => { const work = waiters.splice(0); work.forEach(resolve => resolve()); await Promise.resolve(); await Promise.resolve(); };
  return { service, message, controller, step, wait, errors, moves, loads,
    current: () => ({ pos: [...currentPosition], worldOrCell: location }),
  };
}

test('actual create-actor handler restores saved server location after template loading and after an in-game reconnect', async () => {
  for (const fullLoad of [true, false]) {
    const f = remoteFixture();
    f.service.onCreateActorMessage({ message: f.message });
    assert.equal(f.service.isPlayerSpawning(), true);
    if (fullLoad) { f.step('tick'); f.step('tick'); assert.equal(f.loads.length, 1); }
    f.step('update');
    assert.equal(f.service.isPlayerSpawning(), true);
    for (let i = 0; i < 6 && f.service.isPlayerSpawning(); ++i) await f.wait();
    assert.equal(f.service.isPlayerSpawning(), false);
    assert.deepEqual(f.current(), { pos: target.pos, worldOrCell: target.worldOrCell });
    assert(f.moves.every(move => JSON.stringify(move.pos) === JSON.stringify(target.pos)));
    assert.deepEqual(f.errors, []);
  }
});

test('disconnect invalidates restoration from an old connection', async () => {
  const f = remoteFixture();
  f.service.onCreateActorMessage({ message: f.message });
  f.step('update');
  const before = f.moves.length;
  f.controller.emitter.emit('connectionDisconnect', {});
  await f.wait(); await f.wait();
  assert.equal(f.moves.length, before);
  assert.equal(f.service.isPlayerSpawning(), true);
});

test('a newer authoritative server teleport supersedes the pending login target', async () => {
  const f = remoteFixture();
  f.service.onCreateActorMessage({ message: f.message });
  f.step('update');
  const newer = { worldOrCell: 888, pos: [100, 200, 900], rot: [0, 0, 180] };
  f.service.onTeleportMessage({ message: newer });
  f.step('update');
  for (let i = 0; i < 6 && f.service.isPlayerSpawning(); ++i) await f.wait();
  assert.equal(f.service.isPlayerSpawning(), false);
  assert.deepEqual(f.current(), { pos: newer.pos, worldOrCell: newer.worldOrCell });
  assert.deepEqual(f.errors, []);
});
