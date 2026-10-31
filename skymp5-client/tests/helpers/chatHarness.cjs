// Real adapter TypeScript compiled in isolation; SkyrimPlatform is simulated.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const ts = require('typescript');
const fork = path.resolve(__dirname, '../../..');
const root = fork;
function load(source, imports = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { console, Map, Set, Date, JSON })(name => {
    if (Object.hasOwn(imports, name)) return imports[name];
    throw Error('Unexpected adapter import: ' + name);
  }, module, module.exports);
  return module.exports;
}
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
// Use the fork's actual public enum values, rather than inventing scan codes/menu names.
const typeSource = fs.readFileSync(path.join(fork, 'skymp5-client/node_modules/@skyrim-platform/skyrim-platform/index.d.ts'), 'utf8');
const source = ts.createSourceFile('index.ts', typeSource, ts.ScriptTarget.Latest, true);
const declarations = source.statements.filter(n => ts.isEnumDeclaration(n) && ['Menu', 'DxScanCode'].includes(n.name.text));
const enums = load(declarations.map(n => n.getText(source).replace('const enum', 'enum')).join('\n'));
const MsgType = load(fs.readFileSync(path.join(fork, 'skymp5-client/src/messages.ts'), 'utf8')).MsgType;
const { ChatBridge } = load(read('skymp5-client/src/services/services/chatBridge.ts'), { '../../messages': { MsgType } });
const { UiCoreBridge } = load(read('skymp5-client/src/services/services/uiCoreBridge.ts'), { '../../messages': { MsgType } });
const { BrowserService } = load(read('skymp5-client/src/services/services/browserService.ts'), {
  './uiCoreBridge': { UiCoreBridge },
  skyrimPlatform: enums, '../../view/formView': { FormView: {} }, './clientListener': { ClientListener: class {} }, './chatBridge': { ChatBridge },
});
const { KeyboardEventsService } = load(read('skymp5-client/src/services/services/keyboardEventsService.ts'), {
  '@skyrim-platform/skyrim-platform': enums, './clientListener': { ClientListener: class {} },
});
const { chatReducer } = load(read('skymp5-front/src/features/chat/reducer/index.js'));

function clientHarness(send = () => {}) {
  const native = new EventEmitter(), emitter = new EventEmitter();
  const controller = { on: native.on.bind(native), once: native.once.bind(native), emitter };
  let state = chatReducer(undefined, { type: 'init' }), focused = false, visible = false, documentId = 0;
  const keys = new Set(), menus = new Set(), uiPackets = [], scripts = [];
  const dispatch = packet => {
    uiPackets.push(packet);
    const types = { ready: 'SKYMP_CHAT_READY', message: 'ADD_CHAT_MSG', ack: 'SKYMP_CHAT_ACK', status: 'SKYMP_CHAT_STATUS',
      open: 'SKYMP_CHAT_OPEN', close: 'SKYMP_CHAT_CLOSE', releaseOpenKey: 'SKYMP_CHAT_RELEASE_OPEN_KEY' };
    const type = packet.customPacketType?.slice('skympChat:'.length);
    if (types[type]) state = chatReducer(state, { type: types[type], data: type === 'message' ? packet.message : type === 'status' ? packet.status : packet });
  };
  let execute = code => {
    vm.runInNewContext(code, { window: { dispatchEvent: event => {
      if (event.type === 'skympChat:packet') dispatch(event.detail);
      if (event.type === 'skympChat:probe') native.emit('browserMessage', { arguments: ['skympChat:frontReady', `document_${documentId}`] });
    } },
      CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } }, Event: class { constructor(type) { this.type = type; } } });
  };
  const sp = { browser: {
    setVisible: value => { visible = value; }, isVisible: () => visible,
    setFocused: value => { focused = value; }, isFocused: () => focused,
    executeJavaScript: code => { scripts.push(code); execute(code); },
  }, Input: { isKeyPressed: key => keys.has(key) }, Ui: { isMenuOpen: menu => menus.has(menu) } };
  const browser = new BrowserService(sp, controller);
  const keyboard = new KeyboardEventsService(sp, controller);
  emitter.on('sendMessage', event => send(JSON.parse(event.message.contentJsonDump), event.reliability));
  const update = () => native.emit('update');
  return { native, emitter, sp, keys, menus, scripts, uiPackets, browser, keyboard,
    update, enums, reducer: chatReducer, get state() { return state; }, get focused() { return focused; }, get visible() { return visible; },
    setExecute: fn => { execute = fn; },
    action: action => { state = chatReducer(state, action); },
    front: (...args) => { if (args[0] === 'front-loaded') documentId++; native.emit('browserMessage', { arguments: args }); },
    receive: packet => emitter.emit('customPacketMessage', { message: { t: MsgType.CustomPacket, contentJsonDump: JSON.stringify(packet) } }),
    join: () => { emitter.emit('connectionAccepted', {}); native.emit('browserMessage', { arguments: ['front-loaded'] }); emitter.emit('createActorMessage', { message: { isMe: true } }); },
    press: code => { keys.add(code); update(); }, release: code => { keys.delete(code); update(); },
  };
}
module.exports = { clientHarness, chatReducer };
