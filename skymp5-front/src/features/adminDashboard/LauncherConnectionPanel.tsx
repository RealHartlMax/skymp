import React, { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './launcherConnection.scss';

const messages = {
  "de": {
    "title": "Launcher-Anbindung",
    "intro": "Trage die Werte aus deinem SkyMP-Worlds-Dashboard ein. Die Konfiguration wird automatisch gespeichert.",
    "master": "Anmeldeserver / Master-URL",
    "serverUid": "Öffentliche Server-ID",
    "masterKey": "Privater Serverschlüssel",
    "publicHost": "Öffentliche Spieladresse",
    "port": "Spielport (UDP)",
    "authMode": "Anmeldung",
    "runtimeSource": "Clientpaket / Versionskatalog",
    "resourceDirectory": "Mod-Verzeichnis auf dem Server",
    "resourcesEnabled": "Mod-Synchronisation",
    "online": "Mit Ingame-Login",
    "guestOpen": "Open · ohne Ingame-Login",
    "guestApproval": "Open · Freigabe im Dashboard",
    "offline": "Offline · vertraute Testgruppe",
    "enabled": "Aktiviert",
    "disabled": "Deaktiviert",
    "keyHint": "Ein vorhandener Schlüssel bleibt erhalten, wenn dieses Feld leer bleibt. Der Schlüssel wird nicht an Spieler weitergegeben.",
    "stored": "Vorhandenen Schlüssel beibehalten",
    "empty": "Privaten Schlüssel eingeben",
    "runtimeHint": "Ein Katalog wählt das passende Clientpaket mit SKSE. Leer: kein Clientpaket über diesen Server vorgeben.",
    "save": "Anbindung speichern",
    "saving": "Wird gespeichert …",
    "reload": "Neu laden",
    "loading": "Anbindung wird geladen …",
    "loadError": "Die Anbindung konnte nicht geladen werden. Diese Einstellungen benötigen ein Administratorkonto.",
    "saveError": "Speichern fehlgeschlagen. Bitte Verbindung und Schreibrechte prüfen.",
    "invalid": "Bitte dieses Feld prüfen: ",
    "conflict": "Die Konfiguration wurde inzwischen geändert. Neu laden und erneut speichern.",
    "saved": "Gespeichert. Starte den Spielserver neu, damit Anmeldung, Heartbeat und Downloads die neuen Einstellungen verwenden.",
    "show": "Passwort einblenden",
    "hide": "Passwort ausblenden",
    "unsaved": "Es gibt ungespeicherte Änderungen. Trotzdem neu laden?"
  },
  "en": {
    "title": "Launcher connection",
    "intro": "Enter the values from your SkyMP Worlds dashboard. The server saves its configuration automatically.",
    "master": "Authentication server / master URL",
    "serverUid": "Public server ID",
    "masterKey": "Private server key",
    "publicHost": "Public game address",
    "port": "Game port (UDP)",
    "authMode": "Authentication",
    "runtimeSource": "Client package / version catalog",
    "resourceDirectory": "Server mod directory",
    "resourcesEnabled": "Mod synchronization",
    "online": "With in-game login",
    "guestOpen": "Open · no in-game login",
    "guestApproval": "Open · dashboard approval",
    "offline": "Offline · trusted test group",
    "enabled": "Enabled",
    "disabled": "Disabled",
    "keyHint": "Leave this field empty to keep the existing key. The private key is never sent to players.",
    "stored": "Keep existing key",
    "empty": "Enter private key",
    "runtimeHint": "A catalog selects the matching client package including SKSE. Leave empty to publish no client package through this server.",
    "save": "Save connection",
    "saving": "Saving …",
    "reload": "Reload",
    "loading": "Loading connection …",
    "loadError": "Unable to load the connection. These settings require an administrator account.",
    "saveError": "Saving failed. Check the connection and file permissions.",
    "invalid": "Check this field: ",
    "conflict": "The configuration has changed. Reload before saving again.",
    "saved": "Saved. Restart the game server so authentication, heartbeat and downloads use the new settings.",
    "show": "Show password",
    "hide": "Hide password",
    "unsaved": "There are unsaved changes. Reload anyway?"
  },
  "ru": {
    "title": "Подключение лаунчера",
    "intro": "Введите значения из панели SkyMP Worlds. Сервер сохранит конфигурацию автоматически.",
    "master": "Сервер авторизации / URL master",
    "serverUid": "Публичный ID сервера",
    "masterKey": "Приватный ключ сервера",
    "publicHost": "Публичный адрес игрового сервера",
    "port": "Игровой порт (UDP)",
    "authMode": "Авторизация",
    "runtimeSource": "Клиентский пакет / каталог версий",
    "resourceDirectory": "Папка модов на сервере",
    "resourcesEnabled": "Синхронизация модов",
    "online": "Со входом в игре",
    "guestOpen": "Открыто · без входа в игре",
    "guestApproval": "Открыто · одобрение в панели",
    "offline": "Офлайн · доверенная тестовая группа",
    "enabled": "Включена",
    "disabled": "Отключена",
    "keyHint": "Оставьте поле пустым, чтобы сохранить текущий ключ. Приватный ключ не передаётся игрокам.",
    "stored": "Сохранить текущий ключ",
    "empty": "Введите приватный ключ",
    "runtimeHint": "Каталог выбирает подходящий клиентский пакет со SKSE. Пустое поле: сервер не публикует клиентский пакет.",
    "save": "Сохранить подключение",
    "saving": "Сохранение …",
    "reload": "Загрузить заново",
    "loading": "Загрузка подключения …",
    "loadError": "Не удалось загрузить подключение. Требуется учётная запись администратора.",
    "saveError": "Не удалось сохранить. Проверьте подключение и права на запись.",
    "invalid": "Проверьте поле: ",
    "conflict": "Конфигурация изменилась. Загрузите её заново перед сохранением.",
    "saved": "Сохранено. Перезапустите игровой сервер, чтобы авторизация, heartbeat и загрузки использовали новые настройки.",
    "show": "Показать пароль",
    "hide": "Скрыть пароль",
    "unsaved": "Есть несохранённые изменения. Загрузить заново?"
  }
};
type Fields = {
  master: string; serverUid: string; masterKey: string; publicHost: string; port: number | string;
  authMode: string; runtimeSource: string; resourceDirectory: string;
  resourcesEnabled: boolean; revision: string; hasMasterKey: boolean;
};
export function LauncherConnectionPanel({ onSaved }: { onSaved?: () => void }) {
  const { i18n } = useTranslation();
  const lang = i18n.language.split('-')[0];
  const text = messages[lang as keyof typeof messages] || messages.en;
  const id = useId();
  const [form, setForm] = useState<Fields | null>(null);
  const [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  const [visible, setVisible] = useState(false), [dirty, setDirty] = useState(false);
  const fields = ['master', 'serverUid', 'masterKey', 'publicHost', 'port', 'resourceDirectory', 'runtimeSource'] as const;
  async function load(signal?: AbortSignal) {
    setBusy(true); setStatus('');
    try {
      const response = await fetch('/api/admin/launcher-connection', { credentials:'same-origin', cache:'no-store', signal });
      if (!response.ok) throw Error();
      const data = await response.json();
      if (!signal?.aborted) { setForm({ ...data, masterKey:'' }); setVisible(false); setDirty(false); }
    } catch (error) { if (!signal?.aborted) { setStatus(text.loadError); setForm(null); } }
    finally { if (!signal?.aborted) setBusy(false); }
  }
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, []);
  function update(key: keyof Fields, value: string | boolean) {
    setForm(previous => previous && ({ ...previous, [key]:value })); setDirty(true);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form || busy) return;
    setBusy(true); setStatus(''); setVisible(false);
    try {
      const response = await fetch('/api/admin/launcher-connection', {
        method:'POST', credentials:'same-origin', headers:{'content-type':'application/json'}, body:JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) {
        const field = result.field as keyof typeof text;
        setStatus(response.status === 409 ? text.conflict : response.status === 400 && text[field] ? text.invalid + text[field] : text.saveError);
        window.setTimeout(() => document.getElementById(id + '-' + result.field)?.focus(), 0);
        return;
      }
      setForm({ ...result, masterKey:'' }); setDirty(false); setStatus(text.saved); onSaved?.();
    } catch { setStatus(text.saveError); }
    finally { setBusy(false); }
  }
  return <section className="launcher-connection" aria-labelledby={id + '-title'}>
    <div className="launcher-connection__heading"><h2 id={id + '-title'}>{text.title}</h2>
      <button type="button" disabled={busy} onClick={() => { if (!dirty || window.confirm(text.unsaved)) void load(); }}>{text.reload}</button></div>
    <p>{text.intro}</p>
    {status && <p className="launcher-connection__status" role="status">{status}</p>}
    {!form ? <p>{busy ? text.loading : ''}</p> : <form onSubmit={event => void save(event)}>
      <fieldset disabled={busy} className="launcher-connection__fields">
        <label><span>{text.authMode}</span><select value={form.authMode} onChange={event => update('authMode',event.target.value)}>
          <option value="guestOpen">{text.guestOpen}</option><option value="guestApproval">{text.guestApproval}</option><option value="online">{text.online}</option><option value="offline">{text.offline}</option></select></label>
        {fields.map(key => <label key={key} htmlFor={id + '-' + key}><span id={id + '-' + key + '-label'}>{text[key]}</span>
          <span className={key === 'masterKey' ? 'launcher-connection__password' : undefined}>
            <input id={id + '-' + key} name={key} type={key === 'masterKey' ? (visible ? 'text' : 'password') : key === 'port' ? 'number' : ['master','runtimeSource'].includes(key) ? 'url' : 'text'}
              value={form[key]} aria-labelledby={id + '-' + key + '-label'} autoComplete="off" min={key === 'port' ? 1 : undefined} max={key === 'port' ? 65535 : undefined}
              maxLength={key === 'masterKey' || key === 'serverUid' ? 128 : key === 'resourceDirectory' ? 240 : 2048}
              required={['master','port','resourceDirectory'].includes(key) || form.authMode === 'online' && (key === 'serverUid' || key === 'publicHost' || key === 'masterKey' && !form.hasMasterKey)}
              placeholder={key === 'masterKey' ? form.hasMasterKey ? text.stored : text.empty : undefined}
              aria-describedby={['masterKey','runtimeSource'].includes(key) ? id + '-' + key + '-hint' : undefined}
              onChange={event => update(key,event.target.value)} />
            {key === 'masterKey' && <button className="launcher-connection__eye" type="button" aria-controls={id + '-masterKey'} aria-pressed={visible} aria-label={visible ? text.hide : text.show} title={visible ? text.hide : text.show} onClick={() => setVisible(!visible)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible && <path d="M3 3l18 18"/>}</svg>
            </button>}
          </span>
          {key === 'masterKey' && <small id={id + '-masterKey-hint'}>{text.keyHint}</small>}
          {key === 'runtimeSource' && <small id={id + '-runtimeSource-hint'}>{text.runtimeHint}</small>}
        </label>)}
        <label><span>{text.resourcesEnabled}</span><select value={String(form.resourcesEnabled)} onChange={event => update('resourcesEnabled', event.target.value === 'true')}><option value="true">{text.enabled}</option><option value="false">{text.disabled}</option></select></label>
      </fieldset>
      <button className="launcher-connection__save" type="submit" disabled={busy || !dirty}>{busy ? text.saving : text.save}</button>
    </form>}
  </section>;
}
