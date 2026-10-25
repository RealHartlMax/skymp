const path = require('node:path');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const result = esbuild.buildSync({
  absWorkingDir: root,
  entryPoints: { 'skymp5-server': 'ts/index.ts', 'skymp5-admin': 'ts/dashboard.ts' },
  outdir: path.resolve(root, '../build/dist/server/dist_back'),
  loader: { '.node': 'copy' }, bundle: true, platform: 'node', target: 'es2022',
  keepNames: true, minify: true, sourcemap: true, metafile: true, logLevel: 'info',
  alias: { '@opentelemetry/api': './ts/shims/opentelemetry-api.js' },
});
const dashboard = Object.entries(result.metafile.outputs).find(([file]) => file.endsWith('/skymp5-admin.js'));
assert(dashboard, 'Dashboard bundle missing');
assert(!Object.keys(dashboard[1].inputs).some(file => /(?:scampNative|index)\.ts$/.test(file) && file.startsWith('ts/')), 'Dashboard must not import the native game bootstrap');
const game = Object.entries(result.metafile.outputs).find(([file]) => file.endsWith('/skymp5-server.js'));
assert(!Object.keys(game[1].inputs).some(file => file.includes('node_modules/discord.js/') || file === 'ts/discordBot.ts'), 'Discord Gateway must belong exclusively to the dashboard bundle');
