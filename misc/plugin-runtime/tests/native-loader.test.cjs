const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events');
const {load}=require('./source-loader.cjs'),{fixture}=require('./fixtures.cjs');
const {PluginRuntimeLoader,assertPluginRuntimeReady}=load('skymp5-client/src/services/services/pluginRuntimeLoader.ts',{'../../messages':{MsgType:{CustomPacket:123}}});
function setup(f){
  const nativeRequire=globalThis.require;globalThis.require=name=>name==='node:process'?{cwd:()=>f.game}:require(name);
  let id=0;const handlers=new Map(),scripts=[],logs=[];
  const sp={settings:{'skymp5-client':f.settings},storage:{},browser:{executeJavaScript:code=>scripts.push(code)},unsubscribe:handle=>handlers.delete(handle.uid),printConsole:line=>logs.push(line),mpClientPlugin:{destroyClient:()=>sp.storage.destroyed=true}};
  const subscribe=(event,fn)=>{handlers.set(++id,{event,fn});return {uid:id,eventName:event};};const controller={on:subscribe,once:subscribe,emitter:new EventEmitter()};
  const bindings={bindChat:()=>()=>{},bindUi:()=>()=>{},releaseChatFocus(){},focus(){}};
  const loader=new PluginRuntimeLoader(sp,controller,bindings);
  const browser=(type,payload)=>{for(const value of [...handlers.values()])if(value.event==='browserMessage')value.fn({arguments:[type,payload]});};
  const connect=(hostName='test.local')=>controller.emitter.emit('pluginRuntimeBeforeConnect',{hostName,port:7777});
  return {sp,controller,handlers,scripts,logs,loader,browser,connect,cleanup(){sp.storage.pluginRuntimeDispose();globalThis.require=nativeRequire;}};
}
test('verified module activates once, cleans subscriptions on disconnect and reactivates on reconnect',()=>{
  const f=fixture(),h=setup(f);try{
    h.connect();assertPluginRuntimeReady(h.sp,'test.local',7777);assert.equal(h.sp.storage.activations,1);assert.equal(h.handlers.size,3);
    h.connect();assert.equal(h.sp.storage.activations,1);
    h.controller.emitter.emit('connectionDisconnect',{});assert.equal(h.sp.storage.disposed,1);assert(h.sp.storage.returnedDispose);assert.equal(h.handlers.size,2);assert.equal(h.controller.emitter.listenerCount('connectionAccepted'),0);
    assert.throws(()=>assertPluginRuntimeReady(h.sp,'test.local',7777));h.connect();assert.equal(h.sp.storage.activations,2);
  }finally{h.cleanup();f.remove();}
});
test('unknown publishers, changed bytes, and wrong server fail before any module executes',()=>{
  for(const mode of ['publisher','bytes','server']){const f=fixture();if(mode==='publisher')f.settings['plugin-runtime-publishers']={};if(mode==='bytes')fs.appendFileSync(path.join(f.destination,'client.js'),'tamper');const h=setup(f);
    try{h.connect(mode==='server'?'other.local':'test.local');assert.equal(h.sp.storage.activations,undefined);assert.equal(h.sp.storage.pluginRuntimeState.ready,false);assert.throws(()=>assertPluginRuntimeReady(h.sp,'test.local',7777));assert(h.logs.length>0);}finally{h.cleanup();f.remove();}
  }
});
test('UI activation failure stops connection and remains failed until a corrected preparation/restart',()=>{
  const f=fixture({ui:true}),h=setup(f);try{
    h.connect();h.browser('skympPluginUi:installed',{pluginId:'example',revision:f.revision,ok:false});assert.equal(h.sp.storage.destroyed,true);assert.equal(h.sp.storage.disposed,1);h.connect();assert.equal(h.sp.storage.activations,1);assert.equal(h.sp.storage.pluginRuntimeState.ready,false);
  }finally{h.cleanup();f.remove();}
});
test('reloading generic loader disposes previous root listeners as well as plugin listeners',()=>{
  const f=fixture(),h=setup(f);try{
    h.connect();new PluginRuntimeLoader(h.sp,h.controller,{bindChat:()=>()=>{},bindUi:()=>()=>{},releaseChatFocus(){},focus(){}});assert.equal(h.sp.storage.disposed,1);assert.equal(h.handlers.size,2);assert.equal(h.controller.emitter.listenerCount('pluginRuntimeBeforeConnect'),1);
  }finally{h.cleanup();f.remove();}
});
