/* eslint-disable @typescript-eslint/no-var-requires */
const assert = require('node:assert/strict');

const targetUrl = process.env.PLAYWRIGHT_E2E_URL || 'http://127.0.0.1:1234/?devUi=1';

const serverListPayload = [
  {
    id: 'server-1',
    name: 'SkyMP Main Server',
    ip: '127.0.0.1',
    port: 7777,
    players: 42,
    maxPlayers: 100,
    ping: 24,
    version: '1.0.0',
    online: true,
    tags: ['pve', 'eu']
  },
  {
    id: 'server-2',
    name: 'SkyMP PvP Arena',
    ip: '127.0.0.1',
    port: 7778,
    players: 15,
    maxPlayers: 50,
    ping: 68,
    version: '1.0.0',
    online: true,
    tags: ['pvp', 'arena']
  }
];

const frontendMetricsPayload = {
  summary: {
    totalCount: 3,
    errorCount: 1,
    lastReceivedAt: Date.now(),
    averageValue: 122.33,
    sources: [{ name: 'navigation', count: 2 }, { name: 'window.error', count: 1 }],
    names: [{ name: 'first-contentful-paint', count: 1 }, { name: 'unhandledrejection', count: 1 }]
  },
  entries: [
    {
      name: 'unhandledrejection',
      value: 1,
      source: 'window.error',
      ts: Date.now() - 2000,
      receivedAt: Date.now() - 1000,
      url: 'http://127.0.0.1:1234/?devUi=1'
    },
    {
      name: 'first-contentful-paint',
      value: 144.5,
      source: 'navigation',
      ts: Date.now() - 5000,
      receivedAt: Date.now() - 4000,
      url: 'http://127.0.0.1:1234/?devUi=1'
    }
  ]
};

(async () => {
  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    console.log('[SKIP] Playwright is not installed. Install with: npm --prefix skymp5-front i -D playwright');
    process.exit(0);
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();

  try {
    await page.addInitScript(() => {
      window.localStorage.setItem('skymp.dev.loggedIn', '1');
      window.__connectEvents = [];
      window.addEventListener('serverList:connect', (event) => {
        window.__connectEvents.push(event.detail);
      });
    });

    await page.route('**/api/servers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(serverListPayload)
      });
    });

    await page.route('**/api/admin/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'SkyMP Test',
          online: 3,
          maxPlayers: 100,
          port: 7777,
          uptimeSec: 3600
        })
      });
    });

    await page.route('**/api/admin/players', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ userId: 1, actorId: 1, actorName: 'Dovahkiin', ip: '127.0.0.1', pos: [0, 0, 0] }])
      });
    });

    await page.route('**/api/admin/capabilities', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: 'admin',
          role: 'admin',
          canKick: true,
          canBan: true,
          canUnban: true,
          canConsole: true,
          canViewLogs: true
        })
      });
    });

    await page.route('**/api/admin/bans', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/api/admin/logs**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/api/admin/frontend-metrics**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(frontendMetricsPayload)
      });
    });

    const response = await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    assert.ok(response, 'No response from target URL');
    assert.ok(response.status() < 500, `Target URL responded with ${response.status()}`);

    const title = await page.title();
    assert.equal(typeof title, 'string');

    await page.evaluate(() => {
      window.dispatchEvent(new Event('showServerList'));
    });

    await page.locator('.server-list').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.server-list__search').fill('Arena');
    assert.equal(await page.locator('.server-list__table tbody tr').count(), 1);
    await page.locator('.server-list__favorite-btn').first().evaluate((element) => element.click());
    await page.waitForFunction(() => Boolean(document.querySelector('.server-list__favorite-btn--active')));
    await page.locator('.server-list__filter-full input').nth(1).evaluate((element) => {
      const input = element;
      if (!input.checked) {
        input.click();
      }
    });
    assert.equal(await page.locator('.server-list__table tbody tr').count(), 1);
    await page.locator('.server-list__connect-btn').first().evaluate((element) => element.click());
    await page.waitForFunction(() => Array.isArray(window.__connectEvents) && window.__connectEvents.length > 0);

    const connectEvents = await page.evaluate(() => window.__connectEvents);
    assert.equal(connectEvents.length > 0, true);
    assert.deepEqual(connectEvents[connectEvents.length - 1], { ip: '127.0.0.1', port: 7778 });

    await page.evaluate(() => {
      window.dispatchEvent(new Event('showAdminDashboard'));
    });
    await page.locator('.admin-dashboard').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.admin-dashboard__tab').nth(4).click({ force: true });
    await page.locator('.admin-dashboard__metrics-grid').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.admin-dashboard__metrics-input').fill('paint');
    await page.locator('.admin-dashboard__metrics-toolbar .admin-dashboard__log-page-btn').click({ force: true });
    await page.locator('.admin-dashboard__metrics-name', { hasText: 'first-contentful-paint' }).waitFor({ state: 'visible', timeout: 5000 });

    await page.waitForTimeout(500);
    console.log(`[OK] E2E launcher/admin metrics flow passed for ${targetUrl}`);
  } finally {
    await context.close();
    await browser.close();
  }
})();
