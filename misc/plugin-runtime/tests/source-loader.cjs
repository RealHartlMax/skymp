// Execute source modules in memory for tests. No bundler, emitted build, or package output.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'skymp5-server/node_modules/typescript'));
function load(relative, overrides = {}) {
  const filename = path.resolve(root, relative), source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, { fileName: filename, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.React } });
  const original = Module.createRequire(filename), module = { exports: {} };
  const requireSource = name => Object.hasOwn(overrides, name) ? overrides[name] : original(name);
  Function('require','module','exports','__filename','__dirname',compiled.outputText)(requireSource,module,module.exports,filename,path.dirname(filename));
  return module.exports;
}
module.exports = { root, load };
