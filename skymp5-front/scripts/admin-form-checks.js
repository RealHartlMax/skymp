const assert = require('node:assert/strict');
const { checkAccessibility, checkFocusWrap } = require('./accessibility-checks');

// This fixture owns both write routes: form checks never change a real server.
async function installAdminFormMocks(page) {
  let users = [{ user: 'admin', role: 'admin', isCurrentUser: true, isPrimary: true }];
  const userWrites = [];
  const cfgWrites = [];
  let failNextUserSave = false;
  const whitelistWrites = [];
  let failNextWhitelistSave = false;
  let settings = {
    name: 'SkyMP Forms Test', port: 7777, maxPlayers: 100,
    localeRouting: { defaultLanguage: 'en' },
    joinAccess: { mode: 'none' }, discordBot: { enabled: false },
    starterInventory: { entries: [] }, customSetting: { keep: 'unchanged' },
  };
  await page.route('**/api/admin/admin-users', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      userWrites.push(body);
      if (failNextUserSave) {
        failNextUserSave = false;
        await route.fulfill({ status: 403, json: { error: 'Permission denied for test account' } });
        return;
      }
      users = [...users.filter(user => user.user !== body.user), body];
      await route.fulfill({ json: { ok: true } });
    } else {
      await route.fulfill({ json: { entries: users, currentUser: 'admin', primaryUser: 'admin' } });
    }
  });
  await page.route('**/api/admin/cfg/server-settings', async route => {
    if (route.request().method() === 'POST') {
      settings = JSON.parse(route.request().postDataJSON().json);
      cfgWrites.push(settings);
      await route.fulfill({ json: { ok: true } });
    } else {
      await route.fulfill({ json: { json: JSON.stringify(settings), path: 'mock/server-settings.json' } });
    }
  });
  await page.route('**/api/admin/whitelist/add', async route => {
    const body = route.request().postDataJSON();
    whitelistWrites.push(body);
    if (failNextWhitelistSave) {
      failNextWhitelistSave = false;
      await route.fulfill({ status: 403, json: { error: 'Whitelist approval denied' } });
      return;
    }
    const id = body.identifier.split(':')[1];
    settings.joinAccess.approvedDiscordIds = [...(settings.joinAccess.approvedDiscordIds || []), id];
    await route.fulfill({ json: { ok: true } });
  });

  return async function checkAdminForms(accessibility) {
    await page.locator('[data-testid="admin-top-tab-admins"]').click();
    const add = page.locator('.admin-dashboard__tx-admins-add');
    const dialog = page.locator('[data-testid="admin-user-dialog"]');
    await add.click();
    await dialog.waitFor();
    assert.equal(await dialog.innerText().then(text => text.includes('adminDashboard.')), false,
      'The user form must not display untranslated locale keys');
    const username = dialog.getByRole('textbox', { name: 'Username', exact: true });
    const discord = dialog.getByRole('textbox', { name: 'Discord ID (optional)', exact: true });
    assert.ok(await username.evaluate(element => document.activeElement === element));
    await username.fill('mobile-moderator');
    await discord.fill('invalid-id');
    assert.equal(await discord.getAttribute('aria-invalid'), 'true');
    assert.equal(await dialog.getByRole('button', { name: 'Save', exact: true }).isDisabled(), true);
    await discord.press('Enter');
    assert.equal(userWrites.length, 0, 'Invalid Discord IDs must never be submitted');
    await discord.fill('123456789012345678');
    await dialog.getByRole('combobox', { name: 'Role', exact: true }).selectOption('moderator');
    if (accessibility) {
      await checkAccessibility(page, '[data-testid="admin-user-dialog"]', 'admin-user-create');
      await checkFocusWrap(page, '[data-testid="admin-user-dialog"]');
      await page.setViewportSize({ width: 360, height: 480 });
      const bounds = await dialog.boundingBox();
      const saveBounds = await dialog.getByRole('button', { name: 'Save', exact: true }).boundingBox();
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 480,
        'The user dialog must fit a short viewport');
      assert.ok(saveBounds.y >= 0 && saveBounds.y + saveBounds.height <= 480,
        'Save must remain visible while the form body scrolls');
      await page.setViewportSize({ width: 360, height: 800 });
    }
    failNextUserSave = true;
    await discord.press('Enter');
    await dialog.getByRole('alert').filter({ hasText: 'Permission denied for test account' }).waitFor();
    assert.equal(await dialog.isVisible(), true, 'Server errors must keep the form open');
    assert.equal(await username.inputValue(), 'mobile-moderator');
    if (accessibility) await checkAccessibility(page, '[data-testid="admin-user-dialog"]', 'admin-user-error');
    await discord.press('Enter');
    await dialog.waitFor({ state: 'hidden' });
    assert.ok(await add.evaluate(element => document.activeElement === element));
    assert.deepEqual(userWrites.at(-1), { user: 'mobile-moderator', role: 'moderator', discordId: '123456789012345678' });

    const row = page.locator('.admin-dashboard__tx-admins-table tbody tr').filter({ hasText: 'mobile-moderator' });
    const edit = row.getByRole('button', { name: 'Edit', exact: true });
    await edit.click();
    assert.equal(await username.isDisabled(), true, 'Editing must preserve the username');
    assert.ok(await discord.evaluate(element => document.activeElement === element));
    await dialog.getByRole('combobox', { name: 'Role', exact: true }).selectOption('viewer');
    if (accessibility) await checkAccessibility(page, '[data-testid="admin-user-dialog"]', 'admin-user-edit');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(userWrites.at(-1).role, 'viewer');
    await edit.click();
    const writesBeforeCancel = userWrites.length;
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.ok(await edit.evaluate(element => document.activeElement === element));
    assert.equal(userWrites.length, writesBeforeCancel);
    assert.equal(await page.locator('.admin-overlay').isVisible(), true);

    await page.locator('[data-testid="admin-tab-cfg"]').click();
    const cfg = page.locator('#admin-panel-cfg');
    const serverName = cfg.getByRole('textbox', { name: 'Server name', exact: true });
    await serverName.waitFor();
    await page.waitForFunction(() => document.querySelector('#admin-cfg-panel-general input')?.value === 'SkyMP Forms Test');
    await serverName.fill('Mobile configuration test');
    const tabs = cfg.locator('[role="tablist"]');
    for (const [tab, name] of [['general', 'cfg-general'], ['access', 'cfg-access'], ['inventory', 'cfg-world'], ['json', 'cfg-json']]) {
      const button = tabs.locator(`#admin-cfg-tab-${tab}`);
      await button.click();
      assert.equal(await button.getAttribute('aria-selected'), 'true');
      assert.equal(await cfg.getByRole('tabpanel').getAttribute('aria-labelledby'), `admin-cfg-tab-${tab}`);
      if (accessibility) await checkAccessibility(page, '.admin-overlay', name, `#admin-cfg-panel-${tab}`);
    }
    // Keyboard activation and form state must survive changing configuration tabs.
    await tabs.locator('#admin-cfg-tab-json').focus();
    await page.keyboard.press('Home');
    assert.equal(await serverName.inputValue(), 'Mobile configuration test');
    await page.keyboard.press('ArrowRight');
    assert.equal(await tabs.locator('#admin-cfg-tab-access').getAttribute('aria-selected'), 'true');
    await cfg.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.admin-dashboard__cfg-status')?.textContent.includes('Config saved'));
    assert.equal(cfgWrites.length, 1);
    assert.equal(cfgWrites[0].name, 'Mobile configuration test');
    assert.deepEqual(cfgWrites[0].customSetting, { keep: 'unchanged' });
    assert.equal(cfgWrites[0].localeRouting.defaultLanguage, 'en');
    console.log('[OK] Admin create/edit/error/cancel and configuration tabs/save preserve form data');

    await page.locator('[data-testid="admin-top-tab-whitelist"]').click();
    const approval = page.locator('.admin-dashboard__tx-whitelist-approve');
    const whitelist = page.locator('[data-testid="admin-whitelist-dialog"]');
    if (accessibility) await checkAccessibility(page, '.admin-overlay', 'whitelist-panel', '.admin-dashboard__tx-whitelist');
    await approval.click();
    const identifier = whitelist.getByRole('textbox', { name: 'Identifier', exact: true });
    assert.ok(await identifier.evaluate(element => document.activeElement === element));
    await identifier.fill('unsupported:123');
    assert.equal(await identifier.getAttribute('aria-invalid'), 'true');
    assert.equal(await whitelist.getByRole('button', { name: 'Submit', exact: true }).isDisabled(), true);
    await identifier.press('Enter');
    assert.equal(whitelistWrites.length, 0, 'Invalid whitelist identifiers must not be written');
    await identifier.fill('discord:272600190639848628');
    if (accessibility) {
      await checkAccessibility(page, '[data-testid="admin-whitelist-dialog"]', 'whitelist-dialog');
      await checkFocusWrap(page, '[data-testid="admin-whitelist-dialog"]');
      await page.setViewportSize({ width: 360, height: 480 });
      const bounds = await whitelist.boundingBox();
      const submit = await whitelist.getByRole('button', { name: 'Submit', exact: true }).boundingBox();
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 480);
      assert.ok(submit.y >= 0 && submit.y + submit.height <= 480);
      await page.setViewportSize({ width: 360, height: 800 });
    }
    failNextWhitelistSave = true;
    await identifier.press('Enter');
    await whitelist.getByRole('alert').filter({ hasText: 'Whitelist approval denied' }).waitFor();
    assert.equal(await identifier.inputValue(), 'discord:272600190639848628');
    if (accessibility) await checkAccessibility(page, '[data-testid="admin-whitelist-dialog"]', 'whitelist-error');
    await identifier.press('Enter');
    await whitelist.waitFor({ state: 'hidden' });
    assert.deepEqual(whitelistWrites.at(-1), { identifier: 'discord:272600190639848628' });
    assert.ok(await approval.evaluate(element => document.activeElement === element));
    await page.locator('.admin-dashboard__tx-whitelist-table').getByText('272600190639848628', { exact: true }).waitFor();
    if (accessibility) await checkAccessibility(page, '.admin-overlay', 'whitelist-populated', '.admin-dashboard__tx-whitelist-table');
    await approval.click();
    const count = whitelistWrites.length;
    await page.keyboard.press('Escape');
    await whitelist.waitFor({ state: 'hidden' });
    assert.equal(whitelistWrites.length, count);
    assert.ok(await approval.evaluate(element => document.activeElement === element));
    assert.equal(await page.locator('.admin-overlay').isVisible(), true);
    console.log('[OK] Whitelist validation, failed/retried save, refresh and Escape preserve dialog focus');
  };
}

module.exports = { installAdminFormMocks };
