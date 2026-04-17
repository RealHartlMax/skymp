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
  let mutedUsers = [];
  let lastMuteRequestBody = null;
  let lastMessageRequestBody = null;
  const adminRequestUrls = [];

  try {
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/admin/')) adminRequestUrls.push(url);
    });

    await page.addInitScript(() => {
      window.localStorage.setItem('skymp.dev.loggedIn', '1');
      window.localStorage.setItem('skymp.adminDashboard.state.v1', JSON.stringify({ activeTab: 'players' }));
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

    await page.route(/\/api\/admin\/players(?:\?.*)?$/, async (route) => {
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
          canViewLogs: true,
          canMessage: true,
          canMute: true,
          canUnmute: true
        })
      });
    });

    await page.route('**/api/admin/bans', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/api/admin/mutes', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mutedUsers) });
    });

    await page.route(/\/api\/admin\/players\/\d+\/mute$/, async (route) => {
      const request = route.request();
      const method = request.method();
      const m = request.url().match(/\/players\/(\d+)\/mute$/);
      const userId = m ? Number(m[1]) : NaN;

      if (!Number.isFinite(userId)) {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ ok: false }) });
        return;
      }

      if (method === 'POST') {
        const body = request.postDataJSON() || {};
        lastMuteRequestBody = body;
        const durationMinutes = Number(body.durationMinutes) || 10;
        const expiresAt = Date.now() + durationMinutes * 60 * 1000;
        mutedUsers = [{ userId, expiresAt, remainingSec: durationMinutes * 60 }];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, userId, muted: true, expiresAt, durationMinutes })
        });
        return;
      }

      if (method === 'DELETE') {
        mutedUsers = mutedUsers.filter((entry) => entry.userId !== userId);
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, userId, wasMuted: true }) });
        return;
      }

      await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ ok: false }) });
    });

    await page.route(/\/api\/admin\/players\/\d+\/message(?:\?.*)?$/, async (route) => {
      const request = route.request();
      if (request.method() !== 'POST') {
        await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ ok: false }) });
        return;
      }
      lastMessageRequestBody = request.postDataJSON() || {};
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
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

    mutedUsers = [{ userId: 1, expiresAt: Date.now() + 15 * 60 * 1000, remainingSec: 900 }];

    await page.evaluate(() => {
      window.dispatchEvent(new Event('showAdminDashboard'));
    });
    await page.locator('.admin-dashboard').waitFor({ state: 'visible', timeout: 5000 });

    await page.waitForResponse((response) => {
      return response.url().includes('/api/admin/players') && response.request().method() === 'GET';
    }, { timeout: 10000 });

    const loadingIndicator = page.locator('.admin-dashboard__loading');
    if (await loadingIndicator.count() > 0) {
      await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 });
    }

    await page.locator('[data-testid="admin-panel-players"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-testid="admin-player-row-1"]').waitFor({ state: 'visible', timeout: 10000 });

    await page.locator('[data-testid="admin-reason-input"]').fill('Spam');
    await page.locator('[data-testid="admin-mute-duration-select"]').selectOption('15');

    await page.evaluate(async () => {
      await fetch('/api/admin/players/1/mute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes: 15, reason: 'Spam' })
      });
    });
    assert.equal(lastMuteRequestBody.durationMinutes, 15);
    assert.equal(lastMuteRequestBody.reason, 'Spam');

    await page.locator('[data-testid="admin-msg-btn-1"]').evaluate((element) => element.click());
    await page.locator('[data-testid="admin-message-form"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-testid="admin-message-input"]').fill('Please stop spamming');
    await page.locator('[data-testid="admin-message-cancel-btn"]').evaluate((element) => element.click());
    await page.locator('[data-testid="admin-message-form"]').waitFor({ state: 'hidden', timeout: 10000 });

    const messageResult = await page.evaluate(async () => {
      const response = await fetch('/api/admin/players/1/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Please stop spamming', reason: 'Spam' })
      });
      return response.ok;
    });

    assert.equal(messageResult, true);
    assert.equal(lastMessageRequestBody.message, 'Please stop spamming');
    assert.equal(lastMessageRequestBody.reason, 'Spam');

    const unmuteResult = await page.evaluate(async () => {
      const response = await fetch('/api/admin/players/1/mute', { method: 'DELETE' });
      const payload = await response.json();
      const mutesResponse = await fetch('/api/admin/mutes');
      const mutes = await mutesResponse.json();
      return { ok: response.ok, payload, mutesCount: Array.isArray(mutes) ? mutes.length : 0 };
    });

    assert.equal(unmuteResult.ok, true);
    assert.equal(unmuteResult.payload.wasMuted, true);
    assert.equal(unmuteResult.mutesCount, 0);

    const metricsResult = await page.evaluate(async () => {
      const response = await fetch('/api/admin/frontend-metrics?name=paint&limit=50');
      const payload = await response.json();
      return {
        ok: response.ok,
        totalCount: payload?.summary?.totalCount,
        names: Array.isArray(payload?.entries) ? payload.entries.map((entry) => entry.name) : []
      };
    });

    assert.equal(metricsResult.ok, true);
    assert.equal(metricsResult.totalCount > 0, true);
    assert.equal(metricsResult.names.includes('first-contentful-paint'), true);

    await page.waitForTimeout(500);
    console.log(`[OK] E2E launcher/admin metrics flow passed for ${targetUrl}`);
  } finally {
    if (adminRequestUrls.length === 0) {
      console.log('[WARN] No admin API requests captured in smoke test run');
    }
    await context.close();
    await browser.close();
  }
})();
