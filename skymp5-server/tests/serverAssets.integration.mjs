import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-assets-test-'));
const bundle = process.env.SKYMP_ASSETS_UNIT_BUNDLE || path.join(root, 'assets.cjs');
if (!process.env.SKYMP_ASSETS_UNIT_BUNDLE) require('../node_modules/esbuild').buildSync({
  entryPoints: [path.resolve('../skymp5-server/ts/serverAssets.ts')], outfile: bundle,
  bundle: true, platform: 'node', target: 'es2022', logLevel: 'silent',
});
const api = require(bundle);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOucAAAAASUVORK5CYII=', 'base64');
try {
  const server = path.join(root, 'server'); fs.mkdirSync(server);
  assert.deepEqual(await api.describeServerAssets(server), {});
  fs.mkdirSync(path.join(server, 'server-assets'));
  for (const name of ['logo.png', 'banner.png']) fs.writeFileSync(path.join(server, 'server-assets', name), png);
  const defaults = await api.describeServerAssets(server);
  assert(defaults.logo && defaults.banner);
  const own = Buffer.concat([png, Buffer.from('operator-image')]);
  fs.writeFileSync(path.join(server, 'logo.png'), own);
  assert.notEqual((await api.describeServerAssets(server)).logo.sha256, defaults.logo.sha256);
  assert.deepEqual((await api.readServerAsset('logo', server)).bytes, own);
  fs.writeFileSync(path.join(server, 'logo.png'), 'invalid root file');
  assert.equal((await api.describeServerAssets(server)).logo, undefined, 'Invalid operator image must not be silently replaced');
  fs.unlinkSync(path.join(server, 'logo.png'));
  assert.equal((await api.describeServerAssets(server)).logo.sha256, defaults.logo.sha256);
  fs.writeFileSync(path.join(server, 'server-assets', 'banner.png'), 'not PNG');
  assert.equal((await api.describeServerAssets(server)).banner, undefined);
  if (process.platform !== 'win32') {
    const other = path.join(root, 'outside'); fs.mkdirSync(other);
    fs.writeFileSync(path.join(other, 'banner.png'), png);
    fs.unlinkSync(path.join(server, 'server-assets', 'banner.png'));
    fs.symlinkSync(path.join(other, 'banner.png'), path.join(server, 'server-assets', 'banner.png'));
    assert.equal((await api.describeServerAssets(server)).banner, undefined);
    const linked = path.join(root, 'linked'); fs.mkdirSync(linked);
    fs.symlinkSync(other, path.join(linked, 'server-assets'));
    assert.deepEqual(await api.describeServerAssets(linked), {});
  }
  console.log(JSON.stringify({ ok: true, checks: ['Bundled logo and banner fill missing root images', 'Operator images take precedence and invalid root images are retained', 'Fallback cache follows file changes; invalid PNGs and symlinks are rejected'] }));
} finally {
  assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
  assert(path.basename(root).startsWith('skymp-assets-test-'));
  fs.rmSync(root, { recursive: true, force: true });
}
