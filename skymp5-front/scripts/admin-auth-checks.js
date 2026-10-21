const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { checkAccessibility } = require('./accessibility-checks');

// Render the same server template as /admin without starting a game server.
const filename = path.resolve(__dirname, '../../skymp5-server/ts/adminLoginPage.ts');
const templateModule = new Module(filename, module);
templateModule._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { renderAdminLoginPage } = templateModule.exports;

async function checkAdminAuthentication(context, targetUrl, accessibility) {
  const page = await context.newPage();
  const errors = [];
  const writes = [];
  let mode = 'login';
  let rejectSave = true;
  let discordEnabled = false;
  let holdNextSave = false;
  let releaseSave;
  let saveStarted;
  const adminUser = 'admin"<&';
  const externalUrl = 'https://example.test/</script><script>window.loginInjected=true</script>';
  const origin = new URL(targetUrl).origin;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/__test/admin-login*', route => route.fulfill({
    contentType: 'text/html', body: renderAdminLoginPage({ adminUser, externalUrl, passwordMinLength: 12 }),
  }));
  await page.route('**/api/admin/setup/status', route => route.fulfill({ json: {
    needsSetup: mode === 'setup', canMigrateLegacy: mode === 'migration', passwordMinLength: 12,
  } }));
  await page.route('**/api/admin/session/discord/config', route => route.fulfill({ json: { enabled: discordEnabled } }));
  for (const endpoint of ['session/login', 'setup/bootstrap', 'setup/migrate-legacy']) {
    await page.route(`**/api/admin/${endpoint}`, async route => {
      writes.push({ endpoint, body: route.request().postDataJSON() });
      if (holdNextSave) {
        holdNextSave = false;
        await new Promise(resolve => {
          releaseSave = resolve;
          saveStarted();
        });
      }
      await route.fulfill({ status: rejectSave ? 401 : 200, json: { ok: !rejectSave } });
    });
  }
  await page.route('**/admin?devUi=1&admin=1', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html lang="de"><title>Dashboard fixture</title><main>Authenticated fixture</main></html>',
  }));
  await page.route('**/api/admin/session/discord/start', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html lang="de"><title>Discord fixture</title><main>OAuth redirect fixture</main></html>',
  }));
  const open = async () => {
    await page.goto(`${origin}/__test/admin-login`);
    await page.waitForFunction(() => document.querySelector('#login-form')?.getAttribute('aria-busy') === 'false');
  };
  const fill = async (password, confirmation) => {
    await page.locator('#login-user').fill('test-admin');
    await page.locator('#login-password').fill(password);
    if (confirmation !== undefined) await page.locator('#login-password-confirm').fill(confirmation);
  };
  try {
    await open();
    assert.equal(await page.locator('html').getAttribute('lang'), 'de');
    assert.equal(await page.locator('#login-user').inputValue(), adminUser, 'Configured username must survive HTML escaping');
    assert.equal(await page.evaluate(() => window.__SKYMP_API_BASE_URL__), externalUrl);
    assert.equal(await page.evaluate(() => window.loginInjected), undefined);
    assert.ok(await page.locator('#login-password').evaluate(element => document.activeElement === element));
    assert.equal(await page.locator('#login-discord').isDisabled(), true);
    if (accessibility) await checkAccessibility(page, 'body', 'admin-login');
    await fill('incorrect-password');
    holdNextSave = true;
    const pendingSave = new Promise(resolve => { saveStarted = resolve; });
    await page.locator('#login-password').press('Enter');
    await pendingSave;
    assert.equal(await page.locator('#login-form').getAttribute('aria-busy'), 'true');
    assert.equal(await page.locator('#login-user').isDisabled(), true);
    assert.equal(await page.locator('#login-password').isDisabled(), true);
    assert.equal(await page.locator('#login-submit').isDisabled(), true);
    await page.keyboard.press('Enter');
    assert.equal(writes.length, 1, 'A pending login must not be submitted twice');
    releaseSave();
    await page.getByRole('alert').filter({ hasText: 'Login fehlgeschlagen' }).waitFor();
    assert.equal(await page.locator('#login-user').inputValue(), 'test-admin');
    assert.equal(await page.locator('#login-password').inputValue(), 'incorrect-password');
    assert.ok(await page.locator('#login-password').evaluate(element => document.activeElement === element));
    if (accessibility) await checkAccessibility(page, 'body', 'admin-login-error');
    rejectSave = false;
    await page.locator('#login-password').fill('correct-password');
    await page.locator('#login-password').press('Enter');
    await page.waitForURL('**/admin?devUi=1&admin=1');
    assert.deepEqual(writes.at(-1), { endpoint: 'session/login', body: { user: 'test-admin', password: 'correct-password' } });

    mode = 'setup';
    await open();
    assert.equal(await page.locator('#login-discord').isVisible(), false);
    assert.equal(await page.locator('#login-password').getAttribute('autocomplete'), 'new-password');
    await fill('short', 'short');
    const beforeInvalid = writes.length;
    await page.locator('#login-submit').click();
    assert.equal(writes.length, beforeInvalid, 'Short setup passwords must not reach the API');
    await fill('new-password-123', 'different-password');
    await page.locator('#login-password-confirm').press('Enter');
    await page.getByRole('alert').filter({ hasText: 'stimmt nicht ueberein' }).waitFor();
    assert.equal(writes.length, beforeInvalid, 'Mismatched passwords must not reach the API');
    if (accessibility) await checkAccessibility(page, 'body', 'admin-setup');
    await page.setViewportSize({ width: 360, height: 480 });
    await page.locator('#login-submit').scrollIntoViewIfNeeded();
    const submit = await page.locator('#login-submit').boundingBox();
    assert.ok(submit.y >= 0 && submit.y + submit.height <= 480, 'Submit must be reachable on a short screen');
    await page.setViewportSize({ width: accessibility ? 360 : 1280, height: 800 });
    await page.locator('#login-password-confirm').fill('new-password-123');
    await page.locator('#login-password-confirm').press('Enter');
    await page.waitForURL('**/admin?devUi=1&admin=1');
    assert.deepEqual(writes.at(-1), { endpoint: 'setup/bootstrap', body: {
      user: 'test-admin', password: 'new-password-123', passwordConfirm: 'new-password-123',
    } });

    mode = 'migration';
    await open();
    await page.locator('#login-migrate-toggle').click();
    assert.equal(await page.getByLabel('Altes Passwort', { exact: true }).getAttribute('autocomplete'), 'current-password');
    assert.equal(await page.getByLabel('Neues Passwort', { exact: true }).getAttribute('autocomplete'), 'new-password');
    await fill('old-password', 'migrated-password-123');
    if (accessibility) await checkAccessibility(page, 'body', 'admin-migration');
    await page.locator('#login-password-confirm').press('Enter');
    await page.waitForURL('**/admin?devUi=1&admin=1');
    assert.deepEqual(writes.at(-1), { endpoint: 'setup/migrate-legacy', body: {
      legacyUser: 'test-admin', legacyPassword: 'old-password', user: 'test-admin',
      password: 'migrated-password-123', passwordConfirm: 'migrated-password-123',
    } });
    await open();
    await page.locator('#login-migrate-toggle').click();
    await page.locator('#login-password-confirm').fill('temporary-new-password');
    await page.locator('#login-migrate-toggle').click();
    assert.equal(await page.locator('#login-password-confirm').inputValue(), '', 'Leaving migration clears the new password');
    assert.equal(await page.locator('#login-password-confirm').isVisible(), false);

    mode = 'login';
    discordEnabled = true;
    await open();
    await page.locator('#login-discord').click();
    await page.waitForURL('**/api/admin/session/discord/start');
    assert.deepEqual(errors, [], 'Authentication screens must not raise browser errors');
    console.log('[OK] Admin login/setup/migration validation, failures, redirect and Discord entry');
  } finally {
    await page.close();
  }
}

module.exports = { checkAdminAuthentication };
