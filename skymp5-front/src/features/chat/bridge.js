import { store } from '../../redux/store';
import i18n from '../../i18n';

const translations = {
  de: { title: 'SkyMP Chat', placeholder: 'Nachricht oder /help eingeben', commandsPlaceholder: 'Befehl eingeben, z. B. /help', send: 'Senden', settings: 'Chat-Einstellungen',
    font: 'Schriftgröße', opacity: 'Deckkraft', move: 'Chat verschieben', hint: 'Enter: senden · Esc: zurück zum Spiel · Strg+↑/↓: Verlauf',
    connecting: 'Chat wird verbunden …', disconnected: 'Keine Serververbindung.', unavailable: 'SkyMP Chat ist auf diesem Server nicht verfügbar.',
    missingBridge: 'Die Chat-Anbindung ist nicht verfügbar.', timeout: 'Keine Bestätigung vom Server. Der Entwurf bleibt erhalten.', tooLong: 'Die Nachricht ist zu lang.', pending: 'Warte auf Server …' },
  en: { title: 'SkyMP Chat', placeholder: 'Enter a message or /help', commandsPlaceholder: 'Enter a command, e.g. /help', send: 'Send', settings: 'Chat settings',
    font: 'Font size', opacity: 'Opacity', move: 'Move chat', hint: 'Enter: send · Esc: back to game · Ctrl+↑/↓: history',
    connecting: 'Connecting chat …', disconnected: 'No server connection.', unavailable: 'SkyMP Chat is not available on this server.',
    missingBridge: 'Chat transport is unavailable.', timeout: 'No server acknowledgement. Your draft is preserved.', tooLong: 'The message is too long.', pending: 'Waiting for server …' },
};
Object.entries(translations).forEach(([language, chat]) => i18n.addResourceBundle(language, 'translation', { chat }, true, false));

export function sendChat(text, requestId) {
  if (typeof window.skyrimPlatform?.sendMessage !== 'function') return false;
  window.skyrimPlatform.sendMessage('skympChat:send', { text, requestId });
  return true;
}

export function closeChat() {
  store.dispatch({ type: 'SKYMP_CHAT_CLOSE' });
  window.skyrimPlatform?.sendMessage?.('skympChat:close');
}

export function installChatBridge() {
  // Idempotent even if a frontend loader executes initialization twice.
  window.__skympChatDispose?.();
  const frontId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  const receive = event => {
    const p = event.detail;
    if (!p || typeof p !== 'object') return;
    switch (p.customPacketType) {
      case 'skympChat:ready': store.dispatch({ type: 'SKYMP_CHAT_READY', data: p }); break;
      case 'skympChat:message': store.dispatch({ type: 'ADD_CHAT_MSG', data: p.message }); break;
      case 'skympChat:ack': store.dispatch({ type: 'SKYMP_CHAT_ACK', data: p }); break;
      case 'skympChat:status': store.dispatch({ type: 'SKYMP_CHAT_STATUS', data: p.status }); break;
      case 'skympChat:open': store.dispatch({ type: 'SKYMP_CHAT_OPEN', data: p }); break;
      case 'skympChat:releaseOpenKey': store.dispatch({ type: 'SKYMP_CHAT_RELEASE_OPEN_KEY' }); break;
      case 'skympChat:close': store.dispatch({ type: 'SKYMP_CHAT_CLOSE' }); break;
    }
  };
  const announce = () => window.skyrimPlatform?.sendMessage?.('skympChat:frontReady', frontId);
  window.addEventListener('skympChat:packet', receive);
  window.addEventListener('skympChat:probe', announce);
  window.__skympChatDispose = () => {
    window.removeEventListener('skympChat:packet', receive);
    window.removeEventListener('skympChat:probe', announce);
  };
}
