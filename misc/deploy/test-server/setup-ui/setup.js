'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const steps = ['unlock', 'server', 'data', 'account', 'done'];
  let csrf, details, initialized = false;
  const values = () => ({
    ...Object.fromEntries(new FormData($('server-form'))),
    launcher: {
      steamApiKey: $('steamApiKey').value.trim(), authMode: $('authMode').value, master: $('master').value.trim(), serverUid: $('serverUid').value.trim(),
      masterKey: $('masterKey').value, resourcesEnabled: $('resourcesEnabled').value === 'true',
      resourceDirectory: $('resourceDirectory').value.trim(), runtimeSource: $('runtimeSource').value.trim(),
    },
  });
  function authNote() {
    const online = $('authMode').value === 'online';
    $('serverUid').required = online;
    $('masterKey').required = online && !details?.launcher?.hasMasterKey;
  }
  const error = message => { $('error').textContent = message; };
  function show(step, focus = true) {
    error('');
    for (const name of steps) $(name + '-step').hidden = name !== step;
    document.querySelectorAll('.steps li').forEach((item, index) => {
      if (index === steps.indexOf(step)) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    if (focus) $(step + '-title').focus();
  }
  async function api(route, body) {
    const response = await fetch('/api/setup/' + route, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: body === undefined ? {} : { 'content-type': 'application/json', ...(csrf ? { 'x-skymp-setup-csrf': csrf } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401 && route !== 'unlock') { csrf = undefined; show('unlock'); }
      throw new Error(result.error || 'Anfrage fehlgeschlagen.');
    }
    return result;
  }
  async function busy(button, action) {
    button.disabled = true; button.setAttribute('aria-busy', 'true'); error('');
    try { await action(); }
    catch (failure) { error(failure.name === 'TypeError' || failure.name === 'TimeoutError' ? 'Server nicht erreichbar. Prüfe, ob der Serverstarter noch läuft, und versuche es erneut.' : failure.message); }
    finally { button.disabled = false; button.removeAttribute('aria-busy'); }
  }
  function accessNote() {
    const mode = $('access').value;
    $('public-host-wrap').hidden = mode === 'local';
    $('publicHost').required = mode !== 'local';
    $('access-note').textContent = mode === 'public'
      ? 'Dashboard und Spiel werden über das Internet erreichbar. Gib den TCP-Dashboard-Port und UDP-Spielport auch in der VPS- und Provider-Firewall frei. Für dauerhaften Zugriff HTTPS einrichten.'
      : mode === 'private' ? 'Spieler können sich über das Internet verbinden. Für das Dashboard brauchst du nach der Einrichtung einen SSH-Tunnel.'
        : 'Spiel und Dashboard sind anschließend ausschließlich auf diesem Rechner erreichbar.';
  }
  function renderFiles(installation) {
    $('data-files').replaceChildren();
    const labels = { ready: 'Bereit', missing: 'Fehlt', invalid: 'Ungültige Datei', unreadable: 'Nicht lesbar' };
    for (const file of installation.files) {
      const row = document.createElement('li'), name = document.createElement('span'), status = document.createElement('strong');
      name.textContent = file.name; status.textContent = labels[file.status] || 'Prüfen';
      if (file.status !== 'ready') status.className = 'missing';
      row.append(name, status); $('data-files').append(row);
    }
    $('data-dir').textContent = installation.dataDir + '/';
    $('data-status').textContent = installation.ready ? 'Alle Spieldaten sind vorhanden. Du kannst dein Admin-Konto anlegen.'
      : !installation.runtimeReady ? 'Paketdateien fehlen. Bitte das vollständige Serverarchiv in einen neuen Ordner entpacken.'
        : 'Es fehlen gültige Masterdateien. Nach dem Kopieren „Dateien erneut prüfen“ wählen.';
    $('data-next').disabled = !installation.ready;
  }
  async function loadState() {
    details = await api('state'); csrf = details.csrf;
    if (!initialized) {
      for (const [name, value] of Object.entries(details.defaults)) $(name).value = value;
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
      $('access').value = local ? 'local' : 'public';
      if (!local) $('publicHost').value = location.hostname;
      for (const [name, value] of Object.entries(details.launcher)) {
        if ($(name)) $(name).value = String(value);
      }
      $('steamApiKey').placeholder = details.launcher.hasSteamApiKey ? 'Vorhandenen Steam-Key beibehalten' : 'Steam Web API Key eingeben';
      $('masterKey').placeholder = details.launcher.hasMasterKey ? 'Vorhandenen Schlüssel beibehalten' : 'Privaten Schlüssel eingeben';
      initialized = true; accessNote(); authNote();
    }
    $('complete').textContent = details.startAfterSetup ? 'Einrichtung abschließen und Server starten' : 'Einrichtung abschließen';
    renderFiles(details.installation);
  }
  $('access').addEventListener('change', accessNote);
  $('authMode').addEventListener('change', authNote);
  $('unlock-form').addEventListener('submit', event => {
    event.preventDefault();
    busy(event.submitter, async () => {
      await api('unlock', { code: $('code').value }); $('code').value = '';
      await loadState(); show('server');
    });
  });
  $('server-form').addEventListener('submit', event => {
    event.preventDefault();
    busy(event.submitter, async () => {
      const host = $('publicHost').value.trim();
      if ($('access').value !== 'local' && (!host || /[\s/:?#]/.test(host))) throw new Error('Öffentliche IPv4-Adresse oder Domain ohne http://, Port oder Pfad eingeben.');
      await loadState(); show('data');
    });
  });
  $('data-back').addEventListener('click', () => show('server'));
  $('refresh-data').addEventListener('click', event => busy(event.currentTarget, loadState));
  $('data-next').addEventListener('click', () => {
    const input = values(), modes = { local: 'Nur lokal', private: 'VPS · Admin per SSH-Tunnel', public: 'VPS · öffentlich' };
    const summary = [['Server', input.serverName], ['Verbindung', `${input.access === 'local' ? '127.0.0.1' : input.publicHost} · UDP ${input.port}`], ['Dashboard', `TCP ${input.uiPort} · ${modes[input.access]}`], ['Spielerplätze', input.maxPlayers]];
    $('review').replaceChildren();
    for (const [label, value] of summary) {
      const term = document.createElement('dt'), description = document.createElement('dd');
      term.textContent = label; description.textContent = value; $('review').append(term, description);
    }
    show('account');
  });
  $('account-back').addEventListener('click', () => show('data'));
  $('account-form').addEventListener('submit', event => {
    event.preventDefault();
    busy(event.submitter, async () => {
      if ($('password').value !== $('passwordConfirm').value) throw new Error('Die beiden Passwörter stimmen nicht überein.');
      const input = { ...values(), ...Object.fromEntries(new FormData($('account-form'))) };
      const result = await api('complete', input);
      $('account-form').reset(); input.password = input.passwordConfirm = ''; input.launcher.masterKey = ''; $('masterKey').value = '';
      $('dashboard-link').href = result.dashboard;
      $('done-connection').textContent = `Spielport: UDP ${result.port}. Dashboard: TCP ${result.uiPort}. ${result.access === 'public' ? 'Beide Ports in der VPS- und Provider-Firewall freigeben.' : ''}`;
      show('done');
      if (!result.reachableFromBrowser) {
        $('done-status').textContent = 'Gespeichert. Das Dashboard ist jetzt nur lokal erreichbar. Öffne einen SSH-Tunnel zum gewählten Dashboard-Port und melde dich darüber mit deinem Admin-Konto an.';
      } else if (!result.startAfterSetup) {
        $('done-status').textContent = 'Gespeichert. Starte jetzt start-test-server.sh bzw. start-test-server.cmd und öffne dann dein Dashboard.';
      } else {
        $('done-status').textContent = 'Gespeichert. Der Starter prüft die Installation und startet den Spielserver. Die Weiterleitung zum Dashboard folgt, sobald es bereit ist.';
        if (new URL(result.dashboard).origin === location.origin) waitForDashboard(result.dashboard);
        else $('done-status').textContent = 'Gespeichert. Der Spielserver startet. Öffne das Dashboard über den Button, sobald der Server bereit und der gewählte TCP-Port freigegeben ist.';
      }
    });
  });
  async function waitForDashboard(url) {
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch('/api/admin/setup/status', { cache: 'no-store', signal: AbortSignal.timeout(3000) });
        if (response.ok && (await response.json()).needsSetup === false) { location.replace(url); return; }
      } catch { /* The temporary service hands its port to the real server. */ }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    $('done-status').textContent = 'Einrichtung gespeichert. Der Server ist noch nicht erreichbar. Prüfe die Startmeldung und die Firewall; deine Einstellungen bleiben erhalten.';
  }
  loadState().then(() => show('server', false)).catch(failure => {
    // A new browser has no setup cookie yet; the code form is the normal entry.
    show('unlock', false);
    if (failure.name === 'TypeError') error('Server nicht erreichbar. Prüfe den Serverstarter.');
  });
})();
