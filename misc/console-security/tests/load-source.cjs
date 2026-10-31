const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../../..'),ts=require(path.join(root,'skymp5-server/node_modules/typescript'));
function load(relative,overrides={}){
  const filename=path.resolve(root,relative),module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  const original=createRequire(filename);Function('require','module','exports',code)(name=>Object.hasOwn(overrides,name)?overrides[name]:original(name),module,module.exports);
  return module.exports;
}
module.exports={root,load};
