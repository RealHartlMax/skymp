import { combineReducers, createStore } from 'redux';

import { baseReducers } from './rootReducer';

const extensions = new Map();
const reset = new Set();
const reducer = () => {
  const combined = combineReducers({ ...baseReducers, ...Object.fromEntries([...extensions].map(([key, value]) => [key, value.reducer])) });
  return (state, action) => {
    if (state && reset.size) { state = { ...state }; for (const key of reset) delete state[key]; reset.clear(); }
    return combined(state, action);
  };
};
export const store = createStore(reducer());
export function registerPluginReducer(owner, key, value) {
  if (typeof value !== 'function' || typeof key !== 'string' || !(key.startsWith('plugin:' + owner + ':') || owner === 'skymp-chat' && key === 'chatReducer') || extensions.has(key)) throw Error('Invalid or occupied plugin reducer');
  extensions.set(key, { owner, reducer: value }); reset.add(key); store.replaceReducer(reducer());
  return () => {
    if (extensions.get(key)?.owner !== owner) return;
    extensions.delete(key); reset.add(key); store.replaceReducer(reducer());
  };
}

window.storage = store;
