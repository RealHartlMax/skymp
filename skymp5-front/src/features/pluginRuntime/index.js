import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import * as ReactRedux from 'react-redux';
import * as ReactI18next from 'react-i18next';
import Draggable from 'react-draggable';
import { ResizableBox } from 'react-resizable';
import { store, registerPluginReducer } from '../../redux/store';
import i18n from '../../i18n';

const shared = { react: React, 'react-dom': ReactDOM, 'react-redux': ReactRedux, 'react-i18next': ReactI18next,
  'react-draggable': Draggable, 'react-resizable': { ResizableBox } };
const signal = (type, payload) => window.skyrimPlatform?.sendMessage?.(type, payload);
const changed = () => window.dispatchEvent(new Event('skympPluginUi:changed'));

/** SkyMPPluginUiHost/v1: executes only modules supplied by the verified native loader. */
export function installPluginRuntimeHost() {
  window.SkyMPPluginRuntime?.reset?.();
  const modules = new Map();
  let loading = null, allowed = true, managed = false;
  const root = document.getElementById('skymp-plugin-runtime') || document.createElement('div');
  root.id = 'skymp-plugin-runtime'; Object.assign(root.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '25' });
  if (!root.parentNode) document.body.appendChild(root);
  const remove = id => {
    const module = modules.get(id); if (!module) return;
    module.active = false;
    for (const dispose of module.cleanup.slice().reverse()) { try { dispose(); } catch (error) { console.error('[Plugin UI] Cleanup failed', id, error); } }
    module.style.remove(); module.root.remove(); modules.delete(id); changed();
  };
  const host = {
    apiVersion: 1,
    implementation: 'SkyMPPluginUiHost/v1',
    get managed() { return managed; },
    has: id => modules.has(id),
    setManaged(value) { managed = value === true; changed(); },
    require(name) {
      if (name === 'skymp-plugin-host' && loading) return loading.context;
      if (!Object.prototype.hasOwnProperty.call(shared, name)) throw Error('Unknown shared UI dependency: ' + name);
      return shared[name];
    },
    register(definition) {
      if (!loading || definition?.pluginId !== loading.id || definition.apiVersion !== 1 || typeof definition.mount !== 'function' || loading.registration) throw Error('Plugin UI registration mismatch');
      loading.registration = definition;
    },
    install(payload) {
      const id = payload?.id, revision = payload?.revision;
      if (!/^[a-z][a-z0-9_-]{0,63}$/.test(id) || !/^[a-f0-9]{64}$/.test(revision) || typeof payload.code !== 'string' || payload.code.length > 16 * 1024 * 1024 || typeof payload.css !== 'string' || payload.css.length > 2 * 1024 * 1024 || !payload.assets || typeof payload.assets !== 'object') throw Error('Invalid verified UI module');
      if (modules.get(id)?.revision === revision) { signal('skympPluginUi:installed', { pluginId: id, revision, ok: true }); return; }
      remove(id);
      const element = document.createElement('div'), style = document.createElement('style');
      element.dataset.pluginRuntime = id; root.appendChild(element); style.dataset.pluginRuntime = id;
      const module = { id, revision, root: element, style, cleanup: [], active: true, registration: null };
      const guard = fn => (...args) => module.active ? fn(...args) : undefined;
      const assetUrl = name => {
        if (!Object.prototype.hasOwnProperty.call(payload.assets, name)) throw Error('Asset not declared in the package');
        return payload.assets[name];
      };
      const listen = (event, fn) => {
        if (module.cleanup.length >= 256) throw Error('UI listener limit exceeded');
        const wrapped = guard(fn); window.addEventListener(event, wrapped); const dispose = () => window.removeEventListener(event, wrapped);
        module.cleanup.push(dispose); return dispose;
      };
      module.context = Object.freeze({ apiVersion: 1, pluginId: id, root: element, React, store, i18n, assetUrl,
        registerReducer: (name, reducer) => { const dispose = registerPluginReducer(id, name, reducer); module.cleanup.push(dispose); return dispose; },
        mountReact: component => {
          ReactDOM.render(React.createElement(ReactRedux.Provider, { store }, React.createElement(ReactI18next.I18nextProvider, { i18n }, component)), element);
          module.cleanup.push(() => ReactDOM.unmountComponentAtNode(element));
        },
        requestFocus: guard(focused => signal('skympPluginUi:focus', { pluginId: id, revision, focused: focused === true })),
        send: guard(data => { if (JSON.stringify(data).length > 65536) throw Error('UI message too large'); signal('skympPluginUi:message', { pluginId: id, revision, payload: data }); }),
        onPacket: fn => listen('skympPluginUi:packet', event => { if (event.detail?.id === id) fn(event.detail.payload); }),
        onDismiss: fn => listen('skympPluginUi:dismiss', event => { if (event.detail === id) fn(); }),
        onAllowed: fn => { fn(allowed); return listen('skympPluginUi:allowed', event => fn(event.detail === true)); },
        onDispose: fn => { if (typeof fn !== 'function' || module.cleanup.length >= 256) throw Error('Invalid UI cleanup'); module.cleanup.push(fn); },
      });
      modules.set(id, module);
      try {
        style.textContent = payload.css.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g, (match, _quote, name) => /^data:(?:image|font)\//.test(name) || name.startsWith('#') ? match : 'url(' + JSON.stringify(assetUrl(name.replace(/^\.\//, ''))) + ')');
        document.head.appendChild(style);
        loading = module;
        const script = document.createElement('script'); script.textContent = payload.code;
        let scriptError = null;
        const captureError = event => { scriptError = event.error || Error(event.message || 'Plugin UI script failed'); };
        window.addEventListener('error', captureError);
        try { document.head.appendChild(script); } finally { script.remove(); loading = null; window.removeEventListener('error', captureError); }
        if (scriptError) throw scriptError;
        if (!module.registration) throw Error('UI module did not register');
        const dispose = module.registration.mount(module.context);
        if (dispose !== undefined && typeof dispose !== 'function') throw Error('UI mount must return a cleanup function');
        if (dispose) module.cleanup.push(dispose);
        changed(); signal('skympPluginUi:installed', { pluginId: id, revision, ok: true });
      } catch (error) {
        loading = null; remove(id); signal('skympPluginUi:installed', { pluginId: id, revision, ok: false }); console.error('[Plugin UI] Activation failed', id, error);
      }
    },
    receive(id, payload) { if (modules.get(id)?.active) window.dispatchEvent(new CustomEvent('skympPluginUi:packet', { detail: { id, payload } })); },
    dismiss(id) { window.dispatchEvent(new CustomEvent('skympPluginUi:dismiss', { detail: id })); },
    setAllowed(value) { allowed = value === true; root.inert = !allowed; window.dispatchEvent(new CustomEvent('skympPluginUi:allowed', { detail: allowed })); },
    reset() { for (const id of [...modules.keys()].reverse()) remove(id); },
  };
  window.SkyMPPluginRuntime = host;
  signal('skympPluginUi:hostReady', { apiVersion: 1 });
  return host;
}

export function LegacyPluginUi({ children }) {
  const [managed, setManaged] = useState(window.SkyMPPluginRuntime?.managed === true);
  useEffect(() => { const update = () => setManaged(window.SkyMPPluginRuntime?.managed === true); window.addEventListener('skympPluginUi:changed', update); return () => window.removeEventListener('skympPluginUi:changed', update); }, []);
  return managed ? null : children;
}
