const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { checkAccessibility } = require('./accessibility-checks');

// Use the real client-side widget factory, rather than a copied login layout.
const source = ts.createSourceFile('authService.ts', fs.readFileSync(path.resolve(
  __dirname, '../../skymp5-client/src/services/services/authService.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
let factory;
function findFactory(node) {
  if (ts.isPropertyDeclaration(node) && node.name.getText(source) === 'browsersideWidgetSetter') {
    factory = ts.transpileModule(`const setLoginWidget = ${node.initializer.getText(source)};`, {
      compilerOptions: { target: ts.ScriptTarget.ES2020 },
    }).outputText;
  }
  ts.forEachChild(node, findFactory);
}
findFactory(source);
assert.ok(factory, 'The active client login widget factory must exist');

async function checkGameWidgets(browser, targetUrl, accessibility) {
  const context = await browser.newContext({ locale: 'en-US', viewport: { width: accessibility ? 360 : 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  const logs = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => logs.push(message.text()));
  await page.addInitScript(() => {
    localStorage.removeItem('skymp.dev.loggedIn');
    localStorage.setItem('password', 'retired-demo-password');
    window.__gameMessages = [];
    window.skyrimPlatform = { sendMessage: (event, ...args) => window.__gameMessages.push({ event, args }) };
  });
  const setLogin = async (authenticated, comment = '') => {
    await page.evaluate(({ factory, authenticated, comment }) => {
      const events = { openDiscordOauth: 'openDiscordOauth', selectServer: 'selectServer', useConfiguredServer: 'useConfiguredServer', authAttempt: 'authAttemptEvent' };
      const authData = authenticated ? { discordUsername: 'Test adventurer', masterApiId: 1 } : null;
      const browserState = { comment };
      const selectedServerMasterKey = 'test-main';
      const availableServers = [
        { key: 'test-main', name: 'Main realm with a long server name', online: 12, maxPlayers: 100 },
        { key: 'test-arena', name: 'Arena', online: 3, maxPlayers: 50 },
      ];
      const uiText = {
        authorization: 'Authorization', notAuthorized: 'Not authorized', switchAccount: 'Change account',
        loginViaSkymp: 'Sign in with skymp', switchAccountHint: 'Open sign-in in your browser',
        currentServer: 'Current server', useConfiguredServer: 'Use configured server',
        useConfiguredServerHint: 'Use your configured server address', serverList: 'Available servers',
        serverKey: 'Server key', play: 'Play', playHint: 'Connect to the selected game server',
      };
      // The native client also injects this function and its data into the browser.
      new Function('events', 'authData', 'browserState', 'selectedServerMasterKey', 'availableServers', 'uiText',
        `${factory}; setLoginWidget();`)(events, authData, browserState, selectedServerMasterKey, availableServers, uiText);
    }, { factory, authenticated, comment });
  };
  try {
    const url = new URL(targetUrl);
    url.search = '';
    url.hash = '';
    await page.goto(url.href);
    await page.waitForFunction(() => Boolean(window.skyrimPlatform?.widgets));
    assert.equal(await page.evaluate(() => localStorage.getItem('password')), null,
      'A previously stored demo password must be removed on startup');
    await setLogin(false);
    const root = page.locator('.widget-form');
    await root.waitFor();
    const login = root.getByRole('button', { name: 'Sign in with skymp', exact: true });
    assert.ok(await login.evaluate(element => document.activeElement === element));
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.__gameMessages.at(-1).event), 'openDiscordOauth');
    if (accessibility) await checkAccessibility(page, '.widget-form', 'game-login');
    const server = root.getByRole('button', { name: /Arena/ });
    await server.focus();
    await page.keyboard.press('Space');
    assert.deepEqual(await page.evaluate(() => window.__gameMessages.at(-1)), { event: 'selectServer', args: ['test-arena'] });
    await root.getByRole('button', { name: 'Use configured server', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__gameMessages.at(-1).event), 'useConfiguredServer');
    await login.focus();
    await setLogin(true, 'Account linked. Ready to connect.');
    const change = root.getByRole('button', { name: 'Change account', exact: true });
    assert.ok(await change.evaluate(element => document.activeElement === element),
      'Status/account refresh must preserve focus');
    assert.match(await root.getByRole('status').innerText(), /Ready to connect/);
    if (accessibility) await checkAccessibility(page, '.widget-form', 'game-login-ready');
    await root.getByRole('button', { name: 'Play', exact: true }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.__gameMessages.at(-1).event), 'authAttemptEvent');
    await page.setViewportSize({ width: 360, height: 480 });
    await root.getByRole('button', { name: 'Play', exact: true }).scrollIntoViewIfNeeded();
    const play = await root.getByRole('button', { name: 'Play', exact: true }).boundingBox();
    assert.ok(play.y >= 0 && play.y + play.height <= 480);
    await page.setViewportSize({ width: accessibility ? 360 : 1280, height: 800 });

    // The same renderer is used for input/checkbox forms sent by game scripts.
    await page.evaluate(() => window.skyrimPlatform.widgets.set([{
      id: 2, type: 'form', caption: 'Character options', elements: [
        { type: 'icon', text: 'Character name', tags: ['ICON_STYLE_SKYMP'] },
        { type: 'inputText', initialValue: 'Dovahkiin', onInput: event => window.__gameMessages.push({ event: 'name', value: event.target.value }) },
        { type: 'inputPass', text: 'Access code', initialValue: '', onInput: event => window.__gameMessages.push({ event: 'code', length: event.target.value.length }) },
        { type: 'checkBox', text: 'Show character names', initialValue: false, setChecked: value => window.__gameMessages.push({ event: 'checkbox', value }) },
        { type: 'button', text: 'Unavailable action', isDisabled: true, click: () => window.__gameMessages.push({ event: 'disabled' }) },
        { type: 'button', text: 'Continue', tags: ['BUTTON_STYLE_FRAME'], click: () => window.__gameMessages.push({ event: 'continue' }) },
      ],
    }]));
    const name = root.getByRole('textbox', { name: 'Character name', exact: true });
    await name.fill('New adventurer');
    assert.deepEqual(await page.evaluate(() => window.__gameMessages.at(-1)), { event: 'name', value: 'New adventurer' });
    await root.getByLabel('Access code', { exact: true }).fill('private-test-code');
    const checkbox = root.getByRole('checkbox', { name: 'Show character names', exact: true });
    await checkbox.focus();
    await page.keyboard.press('Space');
    assert.equal(await checkbox.isChecked(), true);
    assert.deepEqual(await page.evaluate(() => window.__gameMessages.at(-1)), { event: 'checkbox', value: true });
    const disabled = root.getByRole('button', { name: 'Unavailable action', exact: true });
    assert.equal(await disabled.isDisabled(), true);
    await page.keyboard.press('Tab');
    assert.ok(await root.getByRole('button', { name: 'Continue', exact: true }).evaluate(element => document.activeElement === element),
      'Tab skips disabled actions');
    if (accessibility) await checkAccessibility(page, '.widget-form', 'game-widget-fields');
    await root.getByRole('button', { name: 'Continue', exact: true }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.__gameMessages.at(-1).event), 'continue');
    assert.equal(await page.evaluate(() => localStorage.getItem('password')), null);
    assert.equal(logs.some(text => /private-test-code|retired-demo-password/.test(text)), false);
    assert.deepEqual(errors, []);
    console.log('[OK] Real client login widget, native events, focus refresh and labelled keyboard controls');
  } finally {
    await context.close();
  }
}

module.exports = { checkGameWidgets };
