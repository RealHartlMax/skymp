/* eslint-disable @typescript-eslint/no-var-requires */
const assert = require('node:assert/strict');

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'commonjs',
  moduleResolution: 'node',
  esModuleInterop: true,
  allowSyntheticDefaultImports: true
});

require('ts-node/register/transpile-only');

const { fetchServerList } = require('../src/features/serverList/api.ts');

const run = async (name, fn) => {
  try {
    await fn();
    console.log(`[OK] ${name}`);
  } catch (error) {
    console.error(`[FAIL] ${name}`);
    throw error;
  }
};

const withMockFetch = async (impl, fn) => {
  const prevFetch = global.fetch;
  global.fetch = impl;
  try {
    await fn();
  } finally {
    global.fetch = prevFetch;
  }
};

const baseServer = {
  id: 'id-1',
  name: 'Server 1',
  ip: '127.0.0.1',
  port: 7777,
  players: 5,
  maxPlayers: 100,
  ping: 33,
  version: '1.0.0',
  online: true
};

(async () => {
  await run('fetchServerList uses absolute endpoint with /api/servers', async () => {
    let capturedUrl = '';
    await withMockFetch(async (url) => {
      capturedUrl = String(url);
      return {
        ok: true,
        json: async () => [baseServer]
      };
    }, async () => {
      const data = await fetchServerList('http://localhost:7777');
      assert.equal(Array.isArray(data), true);
      assert.equal(data.length, 1);
      assert.equal(capturedUrl, 'http://localhost:7777/api/servers');
    });
  });

  await run('fetchServerList prepends protocol for host:port endpoints', async () => {
    let capturedUrl = '';
    await withMockFetch(async (url) => {
      capturedUrl = String(url);
      return {
        ok: true,
        json: async () => [baseServer]
      };
    }, async () => {
      await fetchServerList('192.168.0.2:7777');
      assert.equal(capturedUrl, 'http://192.168.0.2:7777/api/servers');
    });
  });

  await run('fetchServerList throws for non-OK responses', async () => {
    await withMockFetch(async () => ({
      ok: false,
      status: 503,
      json: async () => ({})
    }), async () => {
      await assert.rejects(() => fetchServerList('http://localhost:7777'), /server-list-api:503/);
    });
  });

  await run('fetchServerList throws for invalid payload', async () => {
    await withMockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ invalid: true })
    }), async () => {
      await assert.rejects(() => fetchServerList('http://localhost:7777'), /invalid-payload/);
    });
  });

  console.log('API integration tests passed');
})();
