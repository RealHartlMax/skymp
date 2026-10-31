import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

import App from './App';
import { UiCoreHost } from './features/uiCore';
import './features/uiCore/index.css';
import { installPluginRuntimeHost, LegacyPluginUi } from './features/pluginRuntime';
import { AppErrorBoundary } from './components/AppErrorBoundary/AppErrorBoundary';
import './i18n';
import './main.scss';
import { store } from './redux/store';
import { Widgets } from './utils/Widgets';
import { initPerformanceMonitoring } from './utils/performanceMonitoring';
import { installChatBridge } from './features/chat/bridge';
import { installSessionEndUi } from './features/sessionEnd';

if (!window.skyrimPlatform) {
  window.skyrimPlatform = {};
  window.needToScroll = true;
}

if (!window.skyrimPlatform.widgets) {
  window.skyrimPlatform.widgets = new Widgets([]);
}

initPerformanceMonitoring();
installChatBridge();
installPluginRuntimeHost();
installSessionEndUi();

ReactDOM.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <Provider store={store}>
        <App elem={window.skyrimPlatform.widgets.get()} />
        <LegacyPluginUi><UiCoreHost /></LegacyPluginUi>
      </Provider>
    </AppErrorBoundary>
  </React.StrictMode>,
  document.getElementById('root'),
);

// Called from skymp5-functions-lib, chatProperty.ts
window.scrollToLastMessage = () => {
  const _list = document.querySelector(
    '#chat > .chat-main > .list > .chat-list',
  );
  if (_list != null && window.needToScroll) {
    _list.scrollTop = _list.offsetHeight * _list.offsetHeight;
  }
};

window.playSound = (name) => {
  new Audio(require('./sound/' + name).default).play();
};

if (window.skyrimPlatform?.sendMessage) {
  window.skyrimPlatform.sendMessage('front-loaded');
}
