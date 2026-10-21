interface AdminLoginPageOptions {
  adminUser: string;
  externalUrl: string;
  passwordMinLength: number;
}

/** Server-rendered entry page, also used by browser regression tests. */
export function renderAdminLoginPage({
  adminUser,
  externalUrl,
  passwordMinLength,
}: AdminLoginPageOptions): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  };
  const escapedAdminUser = adminUser.replace(/[&<>"']/g, character => htmlEntities[character]);
  const externalUrlJson = JSON.stringify(externalUrl).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <script>window.__SKYMP_API_BASE_URL__ = ${externalUrlJson};</script>
  <title>SkyMP Admin Login</title>
  <style>
    :root {
      --bg: #0b0f15;
      --panel: #121a27;
      --line: #273246;
      --text: #e6edf8;
      --muted: #9cb0ca;
      --brand: #2ec7b8;
      --brand-2: #6fd6cc;
      --danger: #ff7c7c;
    }
    * { box-sizing: border-box; }
    html, body { min-height: 100%; margin: 0; }
    body {
      min-height: 100vh;
      min-height: 100dvh;
      font-family: "Trebuchet MS", "Segoe UI", Tahoma, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at 10% -20%, rgba(46,199,184,.28) 0%, rgba(46,199,184,0) 36%),
        radial-gradient(circle at 90% -12%, rgba(121,140,255,.2) 0%, rgba(121,140,255,0) 33%),
        linear-gradient(180deg, #0d1119 0%, #0a0f16 60%, #090d13 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
    }
    .login-card {
      margin: auto;
      flex-shrink: 0;
      min-width: 0;
      width: min(420px, 100%);
      border: 1px solid var(--line);
      border-radius: 16px;
      background: rgba(18, 26, 39, 0.92);
      box-shadow: 0 18px 80px rgba(0,0,0,.38);
      overflow: hidden;
    }
    .login-head {
      padding: 18px 20px 12px;
      border-bottom: 1px solid var(--line);
    }
    .login-title { margin: 0; font-size: 22px; color: var(--brand-2); }
    .login-sub { margin: 6px 0 0; color: var(--muted); font-size: 13px; }
    .login-form { padding: 18px 20px 20px; display: grid; gap: 12px; }
    .login-label { display: grid; gap: 6px; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
    .login-input {
      width: 100%;
      border: 1px solid #33435f;
      background: #0d1420;
      color: var(--text);
      border-radius: 10px;
      height: 42px;
      padding: 0 12px;
      font-size: 14px;
      outline: none;
    }
    .login-input:focus { border-color: var(--brand); box-shadow: 0 0 0 2px rgba(46,199,184,.2); }
    .login-btn {
      border: 1px solid rgba(46,199,184,.45);
      background: linear-gradient(180deg, rgba(46,199,184,.3), rgba(46,199,184,.16));
      color: #dcfffb;
      height: 42px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
    }
    .login-btn:disabled { opacity: .65; cursor: wait; }
    :is(button, input, a):focus-visible { outline: 2px solid var(--brand-2); outline-offset: 3px; }
    .login-label, .login-note, .login-error { overflow-wrap: anywhere; }
    .login-password-hint { margin: 0; color: var(--muted); font-size: 12px; }
    .login-label, .login-btn { min-width: 0; }
    .login-btn { height: auto; min-height: 42px; padding: 10px 12px; }
    .login-btn--discord {
      border-color: rgba(132,153,255,.55);
      background: linear-gradient(180deg, rgba(132,153,255,.28), rgba(132,153,255,.14));
      color: #e7edff;
    }
    .login-btn--discord:disabled {
      opacity: .55;
      cursor: not-allowed;
      filter: grayscale(.35);
    }
    .login-discord-note {
      margin: -4px 0 0;
      font-size: 11px;
      color: var(--muted);
      text-align: center;
      display: none;
    }
    .login-error { min-height: 18px; color: var(--danger); font-size: 13px; }
    .login-note { margin: 0; font-size: 12px; color: var(--muted); line-height: 1.4; }
  </style>
</head>
<body>
  <main class="login-card" aria-labelledby="login-title">
    <div class="login-head">
      <h1 id="login-title" class="login-title">SkyMP Admin Login</h1>
      <p id="login-sub" class="login-sub">Melde dich an, um das Dashboard zu oeffnen.</p>
    </div>
    <form class="login-form" id="login-form" aria-busy="true">
      <label class="login-label">Benutzername
        <input id="login-user" class="login-input" type="text" autocomplete="username" value="${escapedAdminUser}" required />
      </label>
      <label class="login-label"><span id="login-password-label">Passwort</span>
        <input id="login-password" class="login-input" type="password" autocomplete="current-password" aria-describedby="login-error" required />
      </label>
      <label class="login-label" id="login-password-confirm-wrap" style="display:none;"><span id="login-password-confirm-label">Passwort bestaetigen</span>
        <input id="login-password-confirm" class="login-input" type="password" autocomplete="new-password" aria-describedby="login-password-hint login-error" />
      </label>
      <p class="login-password-hint" id="login-password-hint" hidden></p>
      <button id="login-submit" class="login-btn" type="submit" disabled>Einloggen</button>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,.1);margin:2px 0;" />
      <button id="login-discord" class="login-btn login-btn--discord" type="button">&#128640; Mit Discord einloggen</button>
      <p id="login-discord-note" class="login-discord-note">Discord OAuth ist noch nicht konfiguriert &mdash; siehe <a href="/docs/docs_admin_discord_oauth" style="color:var(--muted);">Dokumentation</a></p>
      <button id="login-migrate-toggle" class="login-btn" type="button" style="display:none;">Legacy auf sichere Anmeldung migrieren</button>
      <div id="login-error" class="login-error" role="alert" aria-atomic="true"></div>
      <p class="login-note" id="login-note">Sicherheitsregel: Nach 10 Minuten ohne Mausklick auf dieser Seite wirst du automatisch ausgeloggt.</p>
    </form>
  </main>
  <script>
    const form = document.getElementById('login-form');
    const userInput = document.getElementById('login-user');
    const passInput = document.getElementById('login-password');
    const passConfirmWrap = document.getElementById('login-password-confirm-wrap');
    const passConfirmInput = document.getElementById('login-password-confirm');
    const submitBtn = document.getElementById('login-submit');
    const discordBtn = document.getElementById('login-discord');
    const migrateToggleBtn = document.getElementById('login-migrate-toggle');
    const errorBox = document.getElementById('login-error');
    const loginTitle = document.getElementById('login-title');
    const loginSub = document.getElementById('login-sub');
    const loginNote = document.getElementById('login-note');
    const passwordLabel = document.getElementById('login-password-label');
    const confirmLabel = document.getElementById('login-password-confirm-label');
    const passwordHint = document.getElementById('login-password-hint');

    let setupMode = false;
    let migrationMode = false;
    let canMigrateLegacy = false;
    let passwordMinLength = ${passwordMinLength};
    let discordLoginEnabled = false;
    let ready = false;
    let submitting = false;

    const syncControls = () => {
      const busy = !ready || submitting;
      form.setAttribute('aria-busy', String(busy));
      for (const control of [userInput, passInput, passConfirmInput, submitBtn, migrateToggleBtn]) {
        control.disabled = busy;
      }
      discordBtn.disabled = busy || !discordLoginEnabled;
    };

    const syncPasswordFields = () => {
      passConfirmInput.required = setupMode || migrationMode;
      passConfirmInput.minLength = passwordMinLength;
      passInput.minLength = setupMode ? passwordMinLength : 0;
      passInput.setAttribute('aria-describedby', setupMode ? 'login-password-hint login-error' : 'login-error');
      passwordLabel.textContent = migrationMode ? 'Altes Passwort' : 'Passwort';
      confirmLabel.textContent = migrationMode ? 'Neues Passwort' : 'Passwort bestaetigen';
      passwordHint.hidden = !(setupMode || migrationMode);
      passwordHint.textContent = 'Neues Passwort: mindestens ' + passwordMinLength + ' Zeichen.';
    };

    const discordNoteEl = document.getElementById('login-discord-note');
    const syncDiscordButton = () => {
      if (!discordBtn) return;
      const hidden = setupMode || migrationMode;
      discordBtn.style.display = hidden ? 'none' : 'block';
      syncControls();
      if (discordNoteEl) {
        discordNoteEl.style.display = (!hidden && !discordLoginEnabled) ? 'block' : 'none';
      }
    };

    const showSetupMode = () => {
      setupMode = true;
      if (loginTitle) loginTitle.textContent = 'SkyMP Admin Ersteinrichtung';
      if (loginSub) loginSub.textContent = 'Lege jetzt dein erstes Admin-Konto an.';
      if (submitBtn) submitBtn.textContent = 'Admin erstellen';
      if (passConfirmWrap) passConfirmWrap.style.display = 'grid';
      if (passInput) passInput.setAttribute('autocomplete', 'new-password');
      if (loginNote) loginNote.textContent = 'Mit diesem Konto kannst du dich anschließend im Admin-Dashboard anmelden.';
      syncPasswordFields();
      syncDiscordButton();
    };

    const showDiscordQueryMessage = () => {
      const q = new URLSearchParams(window.location.search);
      const state = String(q.get('discord') || '');
      if (!state || !errorBox) return;

      if (state === 'not-authorized') {
        errorBox.textContent = 'Discord-Konto ist keinem Admin-Benutzer zugeordnet.';
      } else if (state === 'disabled') {
        errorBox.textContent = 'Discord-Login ist nicht konfiguriert.';
      } else if (state === 'invalid-state' || state === 'invalid-callback') {
        errorBox.textContent = 'Discord-Login ist abgelaufen oder ungueltig. Bitte erneut versuchen.';
      } else {
        errorBox.textContent = 'Discord-Login fehlgeschlagen. Bitte erneut versuchen.';
      }
    };

    const initializeDiscordLogin = async () => {
      try {
        const response = await fetch('/api/admin/session/discord/config', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) return;
        const data = await response.json();
        discordLoginEnabled = Boolean(data?.enabled);
      } catch {
        discordLoginEnabled = false;
      }
      syncDiscordButton();
    };

    const initializeLoginMode = async () => {
      try {
        const response = await fetch('/api/admin/setup/status', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) return;

        const data = await response.json();
        if (typeof data?.passwordMinLength === 'number' && Number.isFinite(data.passwordMinLength)) {
          passwordMinLength = Math.max(8, Math.floor(data.passwordMinLength));
        }
        if (typeof data?.user === 'string' && !userInput.value) {
          userInput.value = data.user;
        }
        if (data?.needsSetup) {
          showSetupMode();
        } else if (data?.canMigrateLegacy) {
          canMigrateLegacy = true;
          if (migrateToggleBtn) {
            migrateToggleBtn.style.display = 'block';
          }
        }
      } catch {
        // ignore setup mode fetch errors
      }
    };

    const setMigrationMode = (enabled) => {
      migrationMode = Boolean(enabled);
      if (!canMigrateLegacy) return;

      if (migrationMode) {
        if (loginTitle) loginTitle.textContent = 'SkyMP Legacy Migration';
        if (loginSub) loginSub.textContent = 'Alte Zugangsdaten bestaetigen und neues sicheres Passwort setzen.';
        if (submitBtn) submitBtn.textContent = 'Migration ausfuehren';
        if (migrateToggleBtn) migrateToggleBtn.textContent = 'Zurueck zum Login';
        if (passConfirmWrap) passConfirmWrap.style.display = 'grid';
        if (passInput) passInput.setAttribute('autocomplete', 'current-password');
        if (loginNote) loginNote.textContent = 'Gib dein altes Passwort ein und setze ein neues Passwort für die sichere Anmeldung.';
      } else {
        if (loginTitle) loginTitle.textContent = 'SkyMP Admin Login';
        if (loginSub) loginSub.textContent = 'Melde dich an, um das Dashboard zu oeffnen.';
        if (submitBtn) submitBtn.textContent = 'Einloggen';
        if (migrateToggleBtn) migrateToggleBtn.textContent = 'Legacy auf sichere Anmeldung migrieren';
        if (passConfirmWrap) passConfirmWrap.style.display = 'none';
        if (passInput) passInput.setAttribute('autocomplete', 'current-password');
        if (loginNote) loginNote.textContent = 'Sicherheitsregel: Nach 10 Minuten ohne Mausklick auf dieser Seite wirst du automatisch ausgeloggt.';
      }
      if (errorBox) errorBox.textContent = '';
      passConfirmInput.value = '';
      syncPasswordFields();
      syncDiscordButton();
      (userInput.value ? passInput : userInput).focus();
    };

    if (migrateToggleBtn) {
      migrateToggleBtn.addEventListener('click', () => {
        if (setupMode) return;
        setMigrationMode(!migrationMode);
      });
    }

    syncControls();
    void Promise.all([initializeLoginMode(), initializeDiscordLogin()]).finally(() => {
      ready = true;
      syncPasswordFields();
      syncControls();
      (userInput.value ? passInput : userInput).focus();
    });
    showDiscordQueryMessage();

    if (discordBtn) {
      discordBtn.addEventListener('click', () => {
        if (!discordLoginEnabled) return;
        window.location.href = '/api/admin/session/discord/start';
      });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!ready || submitting) return;
      errorBox.textContent = '';
      submitting = true;
      syncControls();
      try {
        const payload = {
          user: String(userInput.value || ''),
          password: String(passInput.value || ''),
        };

        if (setupMode || migrationMode) {
          const confirmValue = String(passConfirmInput.value || '');
          const passwordToValidate = migrationMode ? confirmValue : payload.password;
          if (passwordToValidate.length < passwordMinLength) {
            throw new Error('password too short');
          }
          if (setupMode && payload.password !== confirmValue) {
            throw new Error('password confirm mismatch');
          }
        }

        const response = await fetch(
          setupMode
            ? '/api/admin/setup/bootstrap'
            : (migrationMode ? '/api/admin/setup/migrate-legacy' : '/api/admin/session/login'),
          {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(setupMode
            ? { ...payload, passwordConfirm: String(passConfirmInput.value || '') }
            : (migrationMode
              ? {
                legacyUser: payload.user,
                legacyPassword: payload.password,
                user: payload.user,
                password: String(passConfirmInput.value || ''),
                passwordConfirm: String(passConfirmInput.value || ''),
              }
              : payload)),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(text || 'request failed');
        }

        window.location.href = '/admin?devUi=1&admin=1';
      } catch (error) {
        const msg = String(error && error.message ? error.message : '');
        if ((setupMode || migrationMode) && msg.includes('password too short')) {
          errorBox.textContent = 'Passwort ist zu kurz.';
        } else if ((setupMode || migrationMode) && msg.includes('password confirm mismatch')) {
          errorBox.textContent = 'Passwort-Bestaetigung stimmt nicht ueberein.';
        } else if (migrationMode && msg.includes('legacy credentials are invalid')) {
          errorBox.textContent = 'Alte Zugangsdaten sind ungueltig.';
        } else if (setupMode) {
          errorBox.textContent = 'Ersteinrichtung fehlgeschlagen. Eingaben pruefen.';
        } else if (migrationMode) {
          errorBox.textContent = 'Migration fehlgeschlagen. Daten pruefen.';
        } else {
          errorBox.textContent = 'Login fehlgeschlagen. Bitte Zugangsdaten pruefen.';
        }
      } finally {
        submitting = false;
        syncControls();
        if (errorBox.textContent) (setupMode || migrationMode ? passConfirmInput : passInput).focus();
      }
    });
  </script>
</body>
</html>`;
}
