const { test } = require('node:test');
const assert = require('node:assert/strict');
const { clientHarness, chatReducer } = require('./helpers/chatHarness.cjs');
const ready = { customPacketType: 'skympChat:ready', apiVersion: 1, epoch: 'test-server', maxMessageLength: 500 };
function client() {
  const requests = [];
  const c = clientHarness((packet, reliability) => { assert.equal(reliability, 'reliable'); requests.push(packet); });
  c.join(); c.receive(ready);
  return { c, requests };
}
test('Enter opens visible chat and suppresses its opening key until release; duplicate readiness preserves focus', () => {
  const { c, requests } = client();
  c.press(c.enums.DxScanCode.Enter);
  assert.equal(c.focused, true); assert.equal(c.visible, true); assert.equal(c.state.inputOpen, true); assert.equal(c.state.suppressEnter, true);
  c.front('skympChat:frontReady', 'document_0');
  assert.equal(c.focused, true); assert.equal(c.state.inputOpen, true);
  assert.equal(requests.filter(p => p.customPacketType === 'skympChat:ready').length, 1);
  c.release(c.enums.DxScanCode.Enter); assert.equal(c.state.suppressEnter, false);
});
test('Browser text uses the reliable packet adapter and cannot inject identity fields', () => {
  const { c, requests } = client();
  c.front('skympChat:send', { requestId: 'one', text: 'Hallo', userId: 999, role: 'admin' });
  assert.deepEqual(requests[1], { customPacketType: 'skympChat:send', requestId: 'one', text: 'Hallo' });
  assert.equal(c.state.list.length, 0); // No fabricated local echo.
  c.receive({ customPacketType: 'skympChat:message', message: { id: 'm1', text: 'Hallo', playerName: 'Alice', category: 'player' } });
  assert.equal(c.state.list[0].text, 'Hallo');
  c.receive({ customPacketType: 'skympChat:message', message: { id: 'm1', text: 'Hallo' } });
  assert.equal(c.state.list.length, 1);
});
test('Escape preserves draft; F2 hides CEF; Enter restores it; F6 toggles focus', () => {
  const { c } = client();
  c.action({ type: 'UPDATE_CHAT_INPUT', data: 'draft' });
  c.press(c.enums.DxScanCode.Enter); c.release(c.enums.DxScanCode.Enter);
  c.press(c.enums.DxScanCode.Escape); c.release(c.enums.DxScanCode.Escape);
  assert.equal(c.focused, false); assert.equal(c.state.inputOpen, false); assert.equal(c.state.input, 'draft');
  c.press(c.enums.DxScanCode.F2); c.release(c.enums.DxScanCode.F2); assert.equal(c.visible, false);
  c.press(c.enums.DxScanCode.Enter); c.release(c.enums.DxScanCode.Enter); assert.equal(c.visible, true);
  for (const expected of [false, true]) { c.press(c.enums.DxScanCode.F6); c.release(c.enums.DxScanCode.F6); assert.equal(c.focused, expected); }
});
test('Held hotkeys do not fire again when another key changes', () => {
  const { c } = client();
  c.press(c.enums.DxScanCode.Enter); c.press(c.enums.DxScanCode.A); c.release(c.enums.DxScanCode.A); c.update();
  assert.equal(c.uiPackets.filter(p => p.customPacketType === 'skympChat:open').length, 1);
});
test('Skyrim menus prevent chat overlay and keyboard focus', () => {
  const { c } = client();
  for (const menu of [c.enums.Menu.Inventory, c.enums.Menu.Console, c.enums.Menu.Map, c.enums.Menu.Dialogue, c.enums.Menu.Favorites]) {
    c.menus.add(menu); c.native.emit('menuOpen', { name: menu });
    c.press(c.enums.DxScanCode.Enter); c.release(c.enums.DxScanCode.Enter);
    assert.equal(c.visible, false); assert.equal(c.focused, false);
    c.menus.delete(menu); c.native.emit('menuClose', { name: menu }); assert.equal(c.visible, true);
  }
});
test('UI reload adds no listeners; disconnect and server switch clear private state', () => {
  const { c } = client(); const count = c.native.listenerCount('browserMessage');
  c.front('front-loaded'); c.front('front-loaded'); assert.equal(c.native.listenerCount('browserMessage'), count);
  c.action({ type: 'UPDATE_CHAT_INPUT', data: 'private' }); c.emitter.emit('connectionDisconnect', {});
  assert.equal(c.state.input, ''); assert.equal(c.state.list.length, 0); assert.equal(c.focused, false);
  c.action({ type: 'UPDATE_CHAT_INPUT', data: 'private' }); c.emitter.emit('connectionAccepted', {}); assert.equal(c.state.input, '');
});
test('Unavailable plugin cannot send; Redux tolerates missing list, bounds scrollback and deduplicates IDs', () => {
  const { c, requests } = client(); c.receive({ customPacketType: 'skympChat:unavailable' });
  const count = requests.length; c.front('skympChat:send', { requestId: 'blocked', text: 'Hello' }); assert.equal(requests.length, count);
  let state = chatReducer(undefined, { type: 'UPDATE_CHAT_LIST', data: undefined });
  for (let i = 0; i < 110; i++) state = chatReducer(state, { type: 'ADD_CHAT_MSG', data: { id: 'm' + i, text: '<script>safe text</script>' } });
  assert.equal(state.list.length, 100); assert.equal(state.list[99].text, '<script>safe text</script>');
  state = chatReducer(state, { type: 'ADD_CHAT_MSG', data: state.list[99] }); assert.equal(state.list.length, 100);
});


const timedAction = (state, type, now, data) => chatReducer(state, { type, data, meta: { now } });
const configured = options => timedAction(undefined, 'SKYMP_CHAT_READY', 1000, { ...ready, ...options });

test('HUD starts hidden; Enter reveals it, editing never expires, closing starts a precise 15-second deadline', () => {
  let state = configured();
  assert.equal(state.hudVisible, false); assert.equal(state.hideAt, null);
  state = timedAction(state, 'SKYMP_CHAT_OPEN', 1000);
  assert.equal(state.hudVisible, true); assert.equal(state.hideAt, null);
  assert.equal(timedAction(state, 'SKYMP_CHAT_HIDE', 100000, null), state);
  state = timedAction(state, 'SKYMP_CHAT_CLOSE', 2000);
  assert.equal(state.hideAt, 17000); assert.equal(state.inputOpen, false);
  assert.equal(timedAction(state, 'SKYMP_CHAT_CLOSE', 9000), state); // Native and CEF Escape both fire.
  assert.equal(timedAction(state, 'SKYMP_CHAT_HIDE', 16999, 17000), state);
  state = timedAction(state, 'SKYMP_CHAT_HIDE', 17000, 17000);
  assert.equal(state.hudVisible, false); assert.equal(state.list.length, 0);
});

test('showOnMessage true reveals HUD without input/focus and refreshes only on fresh valid messages', () => {
  let state = configured({ display: { hideAfterSeconds: 20, showOnMessage: true } });
  state = timedAction(state, 'ADD_CHAT_MSG', 1000, { id: 'one', text: 'Hello', category: 'player' });
  assert.equal(state.hudVisible, true); assert.equal(state.inputOpen, false); assert.equal(state.hideAt, 21000);
  assert.equal(timedAction(state, 'ADD_CHAT_MSG', 5000, { id: 'one', text: 'Hello' }), state);
  assert.equal(timedAction(state, 'ADD_CHAT_MSG', 5000, {}), state);
  state = timedAction(state, 'ADD_CHAT_MSG', 20000, { id: 'two', text: 'Again' });
  assert.equal(state.hideAt, 40000);
  assert.equal(timedAction(state, 'SKYMP_CHAT_HIDE', 21000, 21000), state);
  state = timedAction(state, 'SKYMP_CHAT_OPEN', 22000);
  state = timedAction(state, 'ADD_CHAT_MSG', 23000, { id: 'three', text: 'While typing' });
  assert.equal(state.hideAt, null);
  assert.equal(timedAction(state, 'SKYMP_CHAT_HIDE', 40000, 40000), state);
});

test('showOnMessage false buffers messages invisibly and never extends the deadline after leaving input', () => {
  let state = configured({ display: { hideAfterSeconds: 15, showOnMessage: false } });
  state = timedAction(state, 'ADD_CHAT_MSG', 1000, { id: 'one', text: 'Silent' });
  assert.equal(state.list.length, 1); assert.equal(state.hudVisible, false);
  state = timedAction(state, 'SKYMP_CHAT_OPEN', 2000);
  state = timedAction(state, 'UPDATE_CHAT_INPUT', 2000, 'draft');
  state = timedAction(state, 'SKYMP_CHAT_CLOSE', 3000);
  state = timedAction(state, 'ADD_CHAT_MSG', 17000, { id: 'two', text: 'Still silent' });
  assert.equal(state.hideAt, 18000);
  state = timedAction(state, 'SKYMP_CHAT_HIDE', 18000, 18000);
  assert.equal(state.hudVisible, false); assert.equal(state.list.length, 2); assert.equal(state.input, 'draft');
  state = timedAction(state, 'SKYMP_CHAT_OPEN', 19000);
  assert.equal(state.hudVisible, true); assert.equal(state.input, 'draft');
});

test('Malformed/older optional settings fall back safely; reload readiness preserves active deadline', () => {
  let state = configured({ display: { hideAfterSeconds: -1, showOnMessage: 'false' }, commandsOnly: 'true', routing: { mode: 'local', radiusMeters: NaN } });
  assert.equal(state.hideAfterSeconds, 15); assert.equal(state.showOnMessage, true); assert.equal(state.commandsOnly, false);
  assert.equal(state.chatMode, 'global'); assert.equal(state.proximityRadiusMeters, 30);
  state = timedAction(state, 'SKYMP_CHAT_OPEN', 1000);
  state = timedAction(state, 'SKYMP_CHAT_CLOSE', 2000);
  state = timedAction(state, 'SKYMP_CHAT_READY', 3000, ready);
  assert.equal(state.hideAt, 17000);
  state = timedAction(state, 'SKYMP_CHAT_READY', 4000, { ...ready, epoch: 'another-server', display: { showOnMessage: false, hideAfterSeconds: 2 } });
  assert.equal(state.hudVisible, false); assert.equal(state.hideAt, null); assert.equal(state.showOnMessage, false);
  state = timedAction(state, 'SKYMP_CHAT_STATUS', 5000, 'disconnected');
  assert.equal(state.showOnMessage, true); assert.equal(state.hideAfterSeconds, 15);
});

test('Command-only metadata reaches actual client adapter; normal messages are excluded from existing Redux store', () => {
  const { c } = client();
  c.receive({ ...ready, commandsOnly: true, display: { hideAfterSeconds: 7, showOnMessage: false }, routing: { mode: 'proximity', radiusMeters: 30 } });
  assert.equal(c.state.commandsOnly, true); assert.equal(c.state.hideAfterSeconds, 7); assert.equal(c.state.showOnMessage, false);
  assert.equal(c.state.chatMode, 'proximity'); assert.equal(c.state.proximityRadiusMeters, 30);
  c.receive({ customPacketType: 'skympChat:message', message: { text: 'Blocked', category: 'player' } });
  c.receive({ customPacketType: 'skympChat:message', message: { text: 'Blocked system', category: 'system' } });
  assert.equal(c.state.list.length, 0);
  c.receive({ customPacketType: 'skympChat:message', message: { text: 'Pong!', category: 'command' } });
  assert.equal(c.state.list.length, 1); assert.equal(c.state.list[0].text, 'Pong!');
  assert.equal(c.state.hudVisible, false); assert.equal(c.focused, false);
});


test('Server locale and editable UI strings travel through actual client adapter into the existing chat state', () => {
 const { c } = client();
 c.receive({ ...ready, localization: { locale: 'EN', ui: { send: 'Post', settings: 'Chat options', title: '<b>Literal title</b>', extra: 'ignored' } } });
 assert.equal(c.state.locale, 'en'); assert.equal(c.state.ui.send, 'Post');
 assert.equal(c.state.ui.settings, 'Chat options'); assert.equal(c.state.ui.title, '<b>Literal title</b>');
 assert.equal(Object.hasOwn(c.state.ui, 'extra'), false);
});

test('Optional localization metadata is bounded and malformed fields fall back without rejecting chat readiness', () => {
 let state = configured({ localization: { locale: '../en', ui: { send: 'Wrong path' } } });
 assert.equal(state.status, 'ready'); assert.equal(state.locale, null); assert.equal(Object.keys(state.ui).length, 0);
 state = configured({ localization: { locale: 'en', ui: { send: 'a'.repeat(257), settings: 42, hint: 'line\nbreak', title: 'Valid' } } });
 assert.equal(state.locale, 'en'); assert.equal(Object.keys(state.ui).length, 1); assert.equal(state.ui.title, 'Valid');
});

test('Old servers, reconnect and server switches discard previous chat translations', () => {
 let state = configured({ localization: { locale: 'en', ui: { send: 'Post' } } });
 state = timedAction(state, 'SKYMP_CHAT_STATUS', 1000, 'disconnected');
 assert.equal(state.locale, null); assert.equal(Object.keys(state.ui).length, 0);
 state = timedAction(state, 'SKYMP_CHAT_READY', 2000, { ...ready, localization: { locale: 'de', ui: { send: 'Senden' } } });
 assert.equal(state.locale, 'de'); assert.equal(state.ui.send, 'Senden');
 state = timedAction(state, 'SKYMP_CHAT_READY', 3000, { ...ready, epoch: 'legacy-server' });
 assert.equal(state.locale, null); assert.equal(Object.keys(state.ui).length, 0);
});
