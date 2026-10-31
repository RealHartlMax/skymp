import React from 'react';
import ReactDOM from 'react-dom';
import i18n from '../../i18n';
import './styles.css';

const reasons = ['kick', 'ban', 'restart', 'shutdown', 'connectionLost', 'connectionFailed', 'connectionDenied'];
export function SessionEndOverlay({ notice }) {
  const text = key => i18n.t('sessionEnd.' + key);
  const send = action => window.skyrimPlatform?.sendMessage?.('sessionEnd:' + action, notice.id);
  return <section className="session-end__dialog" role="alertdialog" aria-modal="true" aria-labelledby="session-end-title" aria-describedby="session-end-description">
    <p className="session-end__label">SkyMP</p>
    <h1 id="session-end-title">{text(notice.kind + '.title')}</h1>
    <p id="session-end-description">{text(notice.kind + '.body')}</p>
    {notice.message && <blockquote>{notice.message}</blockquote>}
    {notice.kind === 'ban' && <p>{notice.until ? text('until') + ' ' + new Date(notice.until).toLocaleString(i18n.language) : text('permanent')}</p>}
    <p role="status">{text(notice.mainMenu ? 'sessionEnded' : 'returning')}</p>
    <div className="session-end__actions">
      <button type="button" disabled={!notice.mainMenu} onClick={() => send('dismiss')}>{text('mainMenu')}</button>
      {notice.kind !== 'ban' && <button className="session-end__retry" type="button" disabled={!notice.mainMenu} onClick={() => send('retry')}>{text('retry')}</button>}
    </div>
  </section>;
}

/** Core CEF surface stays available after plugin runtime and gameplay cleanup. */
export function installSessionEndUi() {
  window.SkympSessionUi?.dispose?.();
  const root = document.createElement('div'); root.id = 'skymp-session-end'; root.style.display = 'none'; document.body.appendChild(root);
  const banner = document.createElement('div'); banner.id = 'skymp-session-reconnecting'; banner.setAttribute('role', 'status'); banner.style.display = 'none'; document.body.appendChild(banner);
  let current = null, signature = '';
  const draw = () => { if (current) ReactDOM.render(<SessionEndOverlay notice={current} />, root); };
  const key = event => {
    if (current?.mainMenu && event.key === 'Escape') { event.preventDefault(); window.skyrimPlatform?.sendMessage?.('sessionEnd:dismiss', current.id); }
  };
  window.addEventListener('keydown', key);
  i18n.on('languageChanged', draw);
  const host = {
    show(notice) {
      if (notice?.version !== 1 || typeof notice.id !== 'string' || notice.id.length > 96 || !reasons.includes(notice.kind) ||
          typeof notice.message !== 'string' || notice.message.length > 512 || typeof notice.mainMenu !== 'boolean' ||
          notice.until !== null && (!Number.isSafeInteger(notice.until) || notice.until <= 0 || notice.until > 8640000000000000)) return;
      const next = JSON.stringify(notice); if (next === signature) return;
      signature = next; current = notice; root.style.display = 'grid'; draw();
    },
    hide() { current = null; signature = ''; ReactDOM.unmountComponentAtNode(root); root.style.display = 'none'; },
    reconnecting(active) { banner.textContent = active ? i18n.t('sessionEnd.reconnecting') : ''; banner.style.display = active ? 'block' : 'none'; },
    dispose() { host.hide(); root.remove(); banner.remove(); window.removeEventListener('keydown', key); i18n.off('languageChanged', draw); },
  };
  window.SkympSessionUi = host;
  return host;
}
