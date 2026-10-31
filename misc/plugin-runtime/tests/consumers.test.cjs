const {test: nodeTest}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{EventEmitter}=require('node:events');
const {load,root}=require('./source-loader.cjs');
const repos=path.resolve(root,'..');
const workspacePresent=['SkyMP-Chat','SkyMP-UI-Core','SkyMP-YACA-TS','SkyMP-Metabolism','skymp-client-launcher'].every(repo=>fs.existsSync(path.join(repos,repo)));
const test=(name,fn)=>nodeTest(name,{skip:!workspacePresent},fn);
test('Chat owns its native module and uses the injected packet protocol',()=>{
  const bridge=load(path.join(repos,'SkyMP-Chat/Plugins/SkyMPChat/client/bridge.ts'));
  const entry=load(path.join(repos,'SkyMP-Chat/Plugins/SkyMPChat/client/runtime.ts'),{'./bridge':bridge});
  let nativeChat;const events=new Map(),emitter=new EventEmitter(),sent=[];
  emitter.on('sendMessage',packet=>sent.push(packet));
  const dispose=entry.activate({sp:{browser:{executeJavaScript(){}}},controller:{emitter,on:(name,fn)=>events.set(name,fn),once(){}},releaseChatFocus(){},constants:{CustomPacket:123},bindChat:bridge=>nativeChat=bridge});
  assert.equal(entry.apiVersion,1);assert(nativeChat);emitter.emit('createActorMessage',{message:{isMe:true}});
  events.get('browserMessage')({arguments:['skympChat:frontReady','fixture_front']});assert.equal(sent[0].message.t,123);assert.equal(JSON.parse(sent[0].message.contentJsonDump).customPacketType,'skympChat:ready');assert.equal(typeof dispose,'function');dispose();
});
test('UI-Core owns its native bridge, registers dismissal and uses injected CustomPacket',()=>{
  const bridge=load(path.join(repos,'SkyMP-UI-Core/client/native/uiCoreBridge.ts'));
  const entry=load(path.join(repos,'SkyMP-UI-Core/client/runtime.ts'),{'./native/uiCoreBridge':bridge});
  let nativeUi,dismiss;const events=new Map(),emitter=new EventEmitter(),sent=[];emitter.on('sendMessage',packet=>sent.push(packet));
  const dispose=entry.activate({sp:{browser:{executeJavaScript(){}}},controller:{emitter,on:(name,fn)=>events.set(name,fn),once(){}},requestFocus(){},constants:{CustomPacket:123},bindUi:bridge=>nativeUi=bridge,onDismiss:fn=>dismiss=fn});
  assert(nativeUi);assert.equal(typeof dismiss,'function');emitter.emit('createActorMessage',{message:{isMe:true}});
  events.get('browserMessage')({arguments:['skympUi:frontReady',{protocolVersion:1,frontId:'fixture_front',editorVersion:1}]});assert.equal(sent[0].message.t,123);assert.equal(JSON.parse(sent[0].message.contentJsonDump).customPacketType,'skympUi:ready');dispose();
});
test('Metabolism remains a server/UI-Core consumer without its own runtime package',()=>{
  const filename=path.join(repos,'SkyMP-Metabolism/plugin.json');const manifest=JSON.parse(fs.readFileSync(filename));assert.equal(manifest.runtime,undefined);
});
test('SDK copies in all producer plugins match the common protocol byte for byte',()=>{
  for(const repo of ['SkyMP-Chat','SkyMP-UI-Core','SkyMP-YACA-TS']) for(const file of ['contract.cjs','contract.d.cts','package.cjs']) assert.deepEqual(fs.readFileSync(path.join(repos,repo,'tools/plugin-runtime',file)),fs.readFileSync(path.join(__dirname,'..',file)),repo+'/'+file);
});
test('YACA modern clients do not evaluate the legacy overlay a second time',()=>{
  const {buildClientSources}=load(path.join(repos,'SkyMP-YACA-TS/src/clientSources.ts'),{'./configLoader':{KEY_CODES:{F8:66,ADD:78,SUBTRACT:74,CAPITAL:58}}});
  const config={keyBinds:{cycleVoiceRange:'CAPITAL',increaseVoiceRange:'ADD',decreaseVoiceRange:'SUBTRACT'},ui:{toggleKey:'F8'}};
  const sources=buildClientSources('LEGACY_OVERLAY',config);
  for(const [settings,expected]of [[{},true],[{'plugin-runtime-api':1},false],[{'plugin-runtime-api':1,'plugin-runtime-managed':false},true]]){
    const scripts=[],updates=[];const sp={settings:{'skymp5-client':settings},storage:{},on:()=>1,once:(_name,fn)=>updates.push(fn),browser:{executeJavaScript:code=>scripts.push(code)}};
    Function('ctx',sources.events)({sp,sendEvent(){}});updates.shift()();assert.equal(scripts.includes('LEGACY_OVERLAY'),expected);
  }
  const noUi=buildClientSources('',config);assert(Buffer.byteLength(noUi.events)<100*1024);assert(!noUi.events.includes('ASSETS'));
});
test('YACA signed native module unsubscribes its EventSource handle and expires the update chain',()=>{
  const entry=require(path.join(repos,'SkyMP-YACA-TS/client/runtime.cjs')),handle={uid:7,eventName:'browserMessage'},removed=[];
  const state={browserHandler:handle},sp={storage:{skympYaca:state},unsubscribe:value=>removed.push(value)};
  const dispose=entry.activate({sp});assert.equal(entry.apiVersion,1);dispose();assert.equal(state.disabled,true);assert.deepEqual(removed,[handle]);assert.equal(sp.storage.skympYaca,undefined);
});
test('launcher publisher preferences accept only an independently supplied bounded public key map',()=>{
  const {parsePluginRuntimePublishers}=load(path.join(repos,'skymp-client-launcher/launcher/src/launcherPreferences.ts'));
  assert.deepEqual(parsePluginRuntimePublishers('{"publisher":"'+'a'.repeat(64)+'"}'),{publisher:'a'.repeat(64)});
  for(const value of ['[]','{"publisher":"private.pem"}','{"publisher":"'+'a'.repeat(128)+'"}','null'])assert.throws(()=>parsePluginRuntimePublishers(value));
});
test('existing verifier loads the actual updated boot code and publishes only successful runtime preflight',async()=>{
  const {fixture}=require('./fixtures.cjs'),f=fixture(),before=process.cwd(),previousMp=globalThis.mp;
  try{
    fs.writeFileSync(path.join(f.pluginDir,'index.js'),'module.exports = { fixture: true };');
    const pluginManifest=JSON.parse(fs.readFileSync(path.join(f.pluginDir,'plugin.json')));
    Object.assign(pluginManifest,{displayName:'Example fixture',description:'Disposable source test',main:'index.js',optional:true});
    fs.writeFileSync(path.join(f.pluginDir,'plugin.json'),JSON.stringify(pluginManifest));
    const {loadForkLoader}=require(path.join(repos,'SkyMP-Metabolism/tools/fork-loader.cjs'));
    process.chdir(f.directory);const statuses=[],loader=loadForkLoader(root,statuses);
    await loader.bootstrapPlugins({}, {mode:'auto',loadOrder:[],abortOnPluginError:false,processCommandAllowlist:[]});
    assert(statuses.some(value=>value.name==='example'&&value.status==='running'));
    const {PluginRuntimeStore}=load('skymp5-server/ts/pluginRuntimePackages.ts');
    assert.equal(new PluginRuntimeStore(path.join(f.directory,'data')).advertisement().packages[0].pluginId,'example');
  }finally{process.chdir(before);if(previousMp===undefined)delete globalThis.mp;else globalThis.mp=previousMp;f.remove();}
});
