const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createRuntimeManifest}=require('../package.cjs');
const {packageRoot}=require('../contract.cjs');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function fixture(options={}) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'skymp-plugin-source-test-')),pluginDir=path.join(directory,'Plugins/example'),runtime=path.join(pluginDir,'Runtime');fs.mkdirSync(runtime,{recursive:true});
  const pair=crypto.generateKeyPairSync('ed25519'),key=path.join(directory,'publisher.pem');fs.writeFileSync(key,pair.privateKey.export({type:'pkcs8',format:'pem'}));
  const code=options.code??`exports.apiVersion=1;exports.activate=function(api){api.sp.storage.activations=(api.sp.storage.activations||0)+1;api.controller.on('update',function(){});api.controller.emitter.on('connectionAccepted',function(){});api.onDispose(function(){api.sp.storage.disposed=(api.sp.storage.disposed||0)+1;});return function(){api.sp.storage.returnedDispose=true;};};`;
  fs.writeFileSync(path.join(runtime,'client.js'),code);
  const entrypoints={client:'client.js'},files=['client.js'];if(options.ui){fs.writeFileSync(path.join(runtime,'ui.js'),'window.SkyMPPluginRuntime.register({pluginId:"example",apiVersion:1,mount:function(){}});');files.push('ui.js');entrypoints.ui='ui.js';}
  const manifest=createRuntimeManifest({root:runtime,pluginId:'example',version:'1.0.0',entrypoints,files,privateKeyFile:key,keyId:'publisher'});
  fs.writeFileSync(path.join(pluginDir,'plugin.json'),JSON.stringify({name:'example',version:'1.0.0',kind:'gamemode',runtime:'Runtime/manifest.json'}));
  fs.writeFileSync(path.join(pluginDir,'config.json'),'PRIVATE SERVER SECRET');
  const manifestJson=fs.readFileSync(path.join(runtime,'manifest.json'),'utf8'),revision=hash(manifestJson),game=path.join(directory,'game'),destination=path.join(game,packageRoot('example',revision));fs.mkdirSync(destination,{recursive:true});
  for(const file of files)fs.copyFileSync(path.join(runtime,file),path.join(destination,file));
  const index={formatVersion:1,server:{host:'test.local',port:7777},packages:[{revision,manifestJson}]},indexJson=JSON.stringify(index);
  fs.writeFileSync(path.join(game,'Data/Platform/PluginRuntime/active.json'),indexJson);
  const publicKey=pair.publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('hex');
  return {directory,game,pluginDir,runtime,destination,manifest,revision,settings:{'plugin-runtime-api':1,'plugin-runtime-index-sha256':hash(indexJson),'plugin-runtime-publishers':{publisher:publicKey}},remove:()=>fs.rmSync(directory,{recursive:true,force:true})};
}
module.exports={fixture,hash};
