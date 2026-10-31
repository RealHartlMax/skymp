// Exercise the actual client service classes without a Skyrim/native process.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');

function loadService(name, dependencies) {
  const file = path.join(__dirname, '../src/services/services', name[0].toLowerCase() + name.slice(1) + '.ts');
  const source = fs.readFileSync(file, 'utf8');
  const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const declaration = syntax.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === name);
  assert(declaration, 'Actual service class missing: ' + name);
  const globals = syntax.statements.filter(node => ts.isVariableStatement(node)).map(node => node.getText(syntax)).join('\n');
  const code = ts.transpileModule(globals + '\n' + declaration.getText(syntax).replace(/^export /, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Function(...Object.keys(dependencies), code + '\nreturn ' + name)(...Object.values(dependencies));
}

class ClientListener {}
class TimersService {}
class AuthService {}
const trace = [];
const SettingsService = loadService('SettingsService', {
  ClientListener, TimersService, AuthService, logTrace: (...args) => trace.push(args), Utility: {},
  HttpClient: class {
    get(_path, _options, callback) { this.callback?.(callback); }
  },
});
const VerificationService = loadService('ServerJsVerificationService', {
  ClientListener, SettingsService, logTrace: (...args) => trace.push(args), verify: crypto.verify,
});

function fixture(config = {}, serverInfo) {
  const sp = { settings: { 'skymp5-client': { 'server-ip': '127.0.0.1', 'server-port': 7777, 'server-info-ignore': true, ...config } }, storage: {} };
  let settings;
  const controller = { lookupListener(service) {
    if (service === SettingsService) return settings;
    if (service === AuthService) return { readAuthDataFromDisk: () => null };
    if (service === TimersService) return { setTimeout() {} };
    assert.fail('Unexpected service dependency');
  } };
  settings = new SettingsService(sp, controller);
  settings.makeMasterApiClient = () => ({ get(_url, _options, callback) {
    if (serverInfo !== undefined) callback({ status: 200, body: JSON.stringify(serverInfo) });
  } });
  let peer;
  settings.getTargetPeer(value => { peer = value; });
  return { settings, peer, verifier: new VerificationService(sp, controller) };
}

const code = 'ctx.sendEvent({type: "ready"});';
const signed = (body, keyId, privateKey) => body + '\n// skymp:sig:y:' + keyId + ':' + crypto.sign(null, Buffer.from(body), privateKey).toString('base64');

test('direct launcher connection with no public keys accepts unsigned gamemode event sources', () => {
  const f = fixture();
  assert.equal(f.peer.publicKeys, undefined);
  assert.deepEqual(f.verifier.verifyServerJs(code), { src: code, error: null });
  const events = [];
  new Function('ctx', f.verifier.verifyServerJs(code).src)({ sendEvent: value => events.push(value) });
  assert.deepEqual(events, [{ type: 'ready' }]);
});

test('empty key maps from direct settings and serverinfo remain unconfigured', () => {
  for (const f of [fixture({ 'server-public-keys': {} }), fixture({ 'server-info-ignore': false }, { host: '127.0.0.1', port: 7777, publicKeys: {} })]) {
    assert.equal(f.peer.publicKeys, undefined);
    assert.deepEqual(f.verifier.verifyServerJs(code), { src: code, error: null });
  }
});

test('configured keys still require a valid signature and reject unsigned, unknown-key and forged scripts', () => {
  const pair = crypto.generateKeyPairSync('ed25519');
  const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const f = fixture({ 'server-public-keys': { operator: publicKey } });
  assert.equal(f.peer.publicKeys.operator, publicKey);
  assert.equal(f.verifier.verifyServerJs(code).error, 'no signature found');
  const valid = signed(code, 'operator', pair.privateKey);
  assert.deepEqual(f.verifier.verifyServerJs(valid), { src: valid, error: null });
  assert.equal(f.verifier.verifyServerJs(signed(code, 'unknown', pair.privateKey)).error, 'unknown key unknown');
  assert.equal(f.verifier.verifyServerJs(valid.replace('ready', 'forged')).error, 'bad signature');
});

test('configured default and serverinfo keys merge while unresolved target peers remain rejected', () => {
  const pair = crypto.generateKeyPairSync('ed25519');
  const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const f = fixture({ 'server-info-ignore': false, 'server-public-keys': { local: publicKey } }, { host: '127.0.0.1', port: 7777, publicKeys: { remote: publicKey } });
  assert.deepEqual(Object.keys(f.peer.publicKeys).sort(), ['local', 'remote']);
  for (const id of ['local', 'remote']) {
    const value = signed(code, id, pair.privateKey);
    assert.deepEqual(f.verifier.verifyServerJs(value), { src: value, error: null });
  }
  assert.equal(fixture({ 'server-info-ignore': false }).verifier.verifyServerJs(code).error, 'target peer not ready');
});
