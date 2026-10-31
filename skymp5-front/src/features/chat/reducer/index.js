const CATEGORIES = new Set(['player', 'system', 'error', 'command']);
const DISPLAY_DEFAULTS = { hideAfterSeconds: 15, showOnMessage: true };
const defaultState = {
  show: true, list: [], showInput: 'auto', input: '', inputOpen: false,
  status: 'disconnected', epoch: null, maxMessageLength: 500, pending: null, error: null,
  hudVisible: false, hideAt: null, ...DISPLAY_DEFAULTS, commandsOnly: false,
  chatMode: 'global', proximityRadiusMeters: 30, locale: null, ui: {},
};

function normalizeMessage(data) {
  if (typeof data === 'string') return { text: data.slice(0, 500), category: 'system' };
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  // Legacy styled spans are plain text, never arbitrary CSS/HTML.
  const text = Array.isArray(data.text) ? data.text.map(span => typeof span?.text === 'string' ? span.text : '').join('') : data.text;
  if (typeof text !== 'string' || text.length > 500) return null;
  return { text, category: CATEGORIES.has(data.category) ? data.category : 'system',
    id: typeof data.id === 'string' && data.id.length <= 100 ? data.id : undefined,
    playerName: typeof data.playerName === 'string' ? data.playerName.slice(0, 80) : undefined,
    timestamp: Number.isFinite(data.timestamp) && data.timestamp > 0 && data.timestamp <= 8640000000000000 ? data.timestamp : undefined };
}
const permitted = (state, value) => !state.commandsOnly || value.category === 'command' || value.category === 'error';
const inputVisible = state => state.inputOpen || state.showInput === 'true';
const UI_KEYS = ['title', 'placeholder', 'commandsPlaceholder', 'send', 'settings', 'font', 'opacity', 'move', 'hint',
  'connecting', 'disconnected', 'unavailable', 'missingBridge', 'timeout', 'tooLong', 'pending'];
function localization(data) {
  if (!data || typeof data.locale !== 'string' || !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i.test(data.locale)) return { locale: null, ui: {} };
  const ui = {};
  if (data.ui && typeof data.ui === 'object' && !Array.isArray(data.ui)) {
    for (const key of UI_KEYS) {
      const value = Object.prototype.hasOwnProperty.call(data.ui, key) ? data.ui[key] : null;
      if (typeof value === 'string' && value.trim() && value.length <= 256 && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value)) ui[key] = value;
    }
  }
  return { locale: data.locale.toLowerCase(), ui };
}

export const chatReducer = (state = defaultState, action) => {
  // Browser events use the local clock, never a server message timestamp.
  // An explicit event time also makes expiry boundaries deterministic in tests.
  const now = Number.isFinite(action.meta?.now) ? action.meta.now : Date.now();
  switch (action.type) {
    case 'UPDATE_CHAT_SHOW': return { ...state, show: action.data === true };
    case 'UPDATE_CHAT_LIST': return { ...state, list: Array.isArray(action.data) ? action.data.slice(-100).map(normalizeMessage).filter(value => value && permitted(state, value)) : [] };
    case 'ADD_CHAT_MSG': {
      const value = normalizeMessage(action.data);
      const list = Array.isArray(state.list) ? state.list : [];
      if (!value || !permitted(state, value) || (value.id && list.some(message => message.id === value.id))) return state;
      const reveal = state.status === 'ready' && state.showOnMessage;
      return { ...state, list: [...list, value].slice(-100),
        ...(reveal ? { hudVisible: true, hideAt: inputVisible(state) ? null : now + state.hideAfterSeconds * 1000 } : {}) };
    }
    case 'UPDATE_CHAT_SHOWINPUT': return { ...state, showInput: action.data };
    case 'UPDATE_CHAT_INPUT': return { ...state, input: typeof action.data === 'string' ? action.data.slice(0, 500) : '' };
    case 'SKYMP_CHAT_OPEN': return { ...state, show: true, inputOpen: true, hudVisible: true, hideAt: null, error: null, suppressEnter: action.data?.suppressEnter === true };
    case 'SKYMP_CHAT_RELEASE_OPEN_KEY': return { ...state, suppressEnter: false };
    case 'SKYMP_CHAT_CLOSE': return !state.inputOpen ? state : { ...state, inputOpen: false, hudVisible: true, hideAt: now + state.hideAfterSeconds * 1000 };
    case 'SKYMP_CHAT_HIDE': {
      // Stale/duplicate timers cannot hide a reopened or newly revealed HUD.
      if (inputVisible(state) || state.hideAt === null || action.data !== state.hideAt || now < state.hideAt) return state;
      return { ...state, hudVisible: false, hideAt: null };
    }
    case 'SKYMP_CHAT_STATUS': {
      if (!['ready', 'connecting', 'disconnected', 'unavailable'].includes(action.data)) return state;
      return { ...state, ...(action.data === 'disconnected' ? defaultState : {}), status: action.data, pending: null, error: null };
    }
    case 'SKYMP_CHAT_READY': {
      const p = action.data;
      if (p?.apiVersion !== 1 || typeof p.epoch !== 'string' || p.epoch.length > 64 ||
          !Number.isInteger(p.maxMessageLength) || p.maxMessageLength < 1 || p.maxMessageLength > 500) return state;
      const hideAfterSeconds = Number.isInteger(p.display?.hideAfterSeconds) && p.display.hideAfterSeconds >= 1 && p.display.hideAfterSeconds <= 300
        ? p.display.hideAfterSeconds : DISPLAY_DEFAULTS.hideAfterSeconds;
      const showOnMessage = typeof p.display?.showOnMessage === 'boolean' ? p.display.showOnMessage : DISPLAY_DEFAULTS.showOnMessage;
      const commandsOnly = p.commandsOnly === true;
      const reset = state.epoch && state.epoch !== p.epoch;
      const list = reset ? [] : Array.isArray(state.list) ? state.list : [];
      return { ...state, status: 'ready', epoch: p.epoch, maxMessageLength: p.maxMessageLength,
        hideAfterSeconds, showOnMessage, commandsOnly, ...localization(p.localization),
        chatMode: ['global', 'cell', 'proximity'].includes(p.routing?.mode) ? p.routing.mode : 'global',
        proximityRadiusMeters: Number.isFinite(p.routing?.radiusMeters) && p.routing.radiusMeters >= 1 && p.routing.radiusMeters <= 1000 ? p.routing.radiusMeters : 30,
        list: list.filter(value => permitted({ commandsOnly }, value)), pending: null, error: null,
        ...(reset ? { input: '', inputOpen: false, hudVisible: false, hideAt: null } : {}) };
    }
    case 'SKYMP_CHAT_PENDING': return { ...state, pending: action.data, error: null };
    case 'SKYMP_CHAT_ERROR': return { ...state, pending: null, error: action.data };
    case 'SKYMP_CHAT_ACK': {
      if (!state.pending || action.data?.requestId !== state.pending.requestId) return state;
      return { ...state, pending: null, input: action.data.accepted === true && state.input === state.pending.text ? '' : state.input };
    }
    default: return state;
  }
};
