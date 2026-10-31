const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load}=require('./source-loader.cjs'),{fixture,hash}=require('./fixtures.cjs');
const {PluginRuntimeStore,publishPluginRuntimeSelection,publishStartedPluginRuntime,removePublishedPluginRuntime,validatePluginRuntime}=load('skymp5-server/ts/pluginRuntimePackages.ts');
const ctx=()=>({method:'GET',set(){}});
test('only successfully selected plugin Runtime files and exact manifests are public',async()=>{
  const f=fixture(),data=path.join(f.directory,'data');
  try{
    validatePluginRuntime({name:'example',version:'1.0.0',pluginDir:f.pluginDir});
    publishPluginRuntimeSelection(data,[]);const store=new PluginRuntimeStore(data);assert.equal(store.advertisement().packages.length,0);
    publishStartedPluginRuntime(data,{name:'example',version:'1.0.0',pluginDir:f.pluginDir});const ad=store.advertisement();assert.equal(ad.packages.length,1);assert.equal(ad.packages[0].manifestSha256,f.revision);
    const manifest=ctx();store.manifest(f.revision,manifest);assert.equal(hash(manifest.body),f.revision);
    const file=ctx(),entry=f.manifest.files[0];store.download(hash(f.revision+'\0'+entry.path),file);const chunks=[];for await(const chunk of file.body)chunks.push(chunk);assert.equal(hash(Buffer.concat(chunks)),entry.sha256);
    for(const id of ['config.json','../config.json',hash('config.json')]){const privateFile=ctx();store.download(id,privateFile);assert.equal(privateFile.status,404);}
    removePublishedPluginRuntime(data,'example');assert.equal(store.advertisement().packages.length,0);const old=ctx();store.manifest(f.revision,old);assert.equal(old.status,404);
  }finally{f.remove();}
});
test('tampering and incomplete deployment fail preflight, without executing server code',()=>{
  const f=fixture();try{
    fs.appendFileSync(path.join(f.runtime,'client.js'),'tamper');assert.throws(()=>validatePluginRuntime({name:'example',version:'1.0.0',pluginDir:f.pluginDir}),/integrity/);
    const data=path.join(f.directory,'data');publishPluginRuntimeSelection(data,[{name:'example',version:'1.0.0',pluginDir:f.pluginDir}]);assert.throws(()=>new PluginRuntimeStore(data).advertisement(),/differs/);
  }finally{f.remove();}
});
test('changing server plugin metadata requires a restart and is never silently advertised',()=>{
  const f=fixture(),data=path.join(f.directory,'data');try{
    publishPluginRuntimeSelection(data,[{name:'example',version:'1.0.0',pluginDir:f.pluginDir}]);fs.writeFileSync(path.join(f.pluginDir,'plugin.json'),JSON.stringify({name:'example',version:'1.1.0',runtime:'Runtime/manifest.json'}));assert.throws(()=>new PluginRuntimeStore(data).advertisement(),/restart/);
  }finally{f.remove();}
});
