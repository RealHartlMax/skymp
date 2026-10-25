'use strict';
const byId = id => document.getElementById(id);
let pending = false;
const labels = { starting: 'Game-Server startet …', running: 'Game-Server läuft. Dashboard wird geöffnet …', stopping: 'Game-Server wird gestoppt …', stopped: 'Game-Server ist gestoppt.', crashed: 'Game-Server wurde unerwartet beendet. Das Serverprotokoll enthält die Ursache.' };
async function request(route, data) {
  return fetch(route, data === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
}
async function refresh() {
  try {
    const response = await request('/api/admin/supervisor/state');
    if (response.status === 401) {
      byId('login').hidden = false; byId('controls').hidden = true;
      byId('status').textContent = 'Bitte mit dem vorhandenen Betreiberkonto anmelden.'; return;
    }
    if (!response.ok) throw Error('Status konnte nicht geladen werden.');
    const value = await response.json();
    byId('login').hidden = true; byId('controls').hidden = false;
    byId('status').textContent = labels[value.state] || value.state;
    const busy = pending || ['starting', 'stopping'].includes(value.state);
    byId('start').disabled = busy || value.state === 'running';
    byId('restart').disabled = busy;
    if (value.state === 'running') window.location.replace('/admin');
  } catch { byId('error').textContent = 'Verwaltung nicht erreichbar. Verbindung und Serverprotokoll prüfen.'; }
}
byId('login').addEventListener('submit', async event => {
  event.preventDefault(); if (pending) return;
  pending = true; byId('error').textContent = '';
  const button = event.currentTarget.querySelector('button'); button.disabled = true;
  try {
    const response = await request('/api/admin/session/login', { user: byId('user').value, password: byId('password').value });
    if (!response.ok) throw Error(response.status === 429 ? 'Zu viele Versuche. Bitte eine Minute warten.' : 'Anmeldung fehlgeschlagen. Betreiberkonto und Passwort prüfen.');
    byId('password').value = ''; await refresh();
  } catch (error) { byId('error').textContent = error.message; }
  finally { pending = false; button.disabled = false; }
});
async function control(action) {
  if (pending) return;
  pending = true; byId('start').disabled = true; byId('restart').disabled = true; byId('error').textContent = '';
  try {
    await request('/api/admin/session/touch', {});
    const response = await request('/api/admin/supervisor/control', { action });
    if (!response.ok) throw Error('Aktion nicht möglich. Sitzung und Serverstatus prüfen.');
  } catch (error) { byId('error').textContent = error.message; }
  finally { pending = false; setTimeout(refresh, 250); }
}
byId('start').addEventListener('click', () => control('start'));
byId('restart').addEventListener('click', () => control('restart'));
byId('logout').addEventListener('click', async () => { await request('/api/admin/session/logout', {}); await refresh(); });
let touched = 0;
document.addEventListener('pointerdown', () => { if (Date.now() - touched > 30000) { touched = Date.now(); void request('/api/admin/session/touch', {}); } });
void refresh(); setInterval(refresh, 1500);
