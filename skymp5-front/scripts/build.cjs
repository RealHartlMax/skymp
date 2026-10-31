#!/usr/bin/env node
// Build this checkout's CEF frontend with its existing webpack rules and budget.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const webpack = require('webpack');
const front = path.resolve(__dirname, '..');
function buildFront({ mode = 'production', output } = {}) {
  if (!['production', 'development'].includes(mode)) throw Error('Expected production or development mode');
  const filename = path.join(front, 'webpack.config.ts');
  // The config is plain CommonJS despite its .ts suffix. This also works on Node 20.
  const configModule = new Module(filename);
  configModule.filename = filename; configModule.paths = Module._nodeModulePaths(front);
  configModule._compile(fs.readFileSync(filename, 'utf8'), filename);
  const config = { ...configModule.exports, context: front, mode };
  if (output) config.output = { ...config.output, path: path.resolve(output) };
  const compiler = webpack(config);
  return new Promise((resolve, reject) => compiler.run((error, stats) => {
    const failure = error || (stats?.hasErrors() ? Error(stats.toString({ all: false, errors: true })) : null);
    const assets = failure ? [] : Object.keys(stats.compilation.assets).sort();
    compiler.close(closeError => {
      if (failure || closeError) return reject(failure || closeError);
      fs.writeFileSync(path.join(config.output.path, 'assets-manifest.json'), JSON.stringify({ version: 1, mode, assets }, null, 2) + '\n');
      console.log(stats.toString({ all: false, assets: true, errors: true, warnings: true, timings: true }));
      resolve({ output: config.output.path, assets });
    });
  }));
}
module.exports = { buildFront };
if (require.main === module) {
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--progress') continue;
    if (!['--mode', '--output'].includes(args[i]) || !args[i + 1]) throw Error('Usage: node scripts/build.cjs [--mode production|development] [--output DIR]');
    options[args[i].slice(2)] = args[++i];
  }
  buildFront(options).catch(error => { console.error(error); process.exitCode = 1; });
}
