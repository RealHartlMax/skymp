const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {load}=require('../../console-security/tests/load-source.cjs');
const {MsgType}=load('skymp5-client/src/messages.ts');
const Menu={Main:'Main Menu',Loading:'Loading Menu'};
const client=load('skymp5-client/src/services/services/sessionEndClient.ts',{'skyrimPlatform':{Menu},'../../messages':{MsgType}});
const {NetworkingService}=load('skymp5-client/src/services/services/networkingService.ts',{
 './sessionEndClient':client,'./clientListener':{ClientListener:class{}},'./pluginRuntimeLoader':{assertPluginRuntimeReady(){}},
 './remoteServer':{RemoteServer:class{}},'../../logging':{logTrace(){},logError(){}},'../../lib/errors':{NeverError:Error},'../../messages':{MsgType},
});
function fixture(options={}){
 const native=new EventEmitter(),emitter=new EventEmitter(),calls={created:[],destroyed:0,sent:[],scripts:[],quit:0,disabled:0,enabled:0,focused:[],visible:[]},queue=[];
 let main=options.main??false,loading=false,insideTick=false,connected=true,papyrus=false;
 const storage=options.storage??{worldModel:{playerCharacterFormIdx:-1}};
 // Mirrors CallNativeApi.cpp: Papyrus natives throw outside the update event.
 const native_=(name,fn)=>(...args)=>{if(!papyrus)throw Error(`'${name}' can't be called in this context`);return fn(...args);};
 const sp={storage,settings:{},Ui:{isMenuOpen:native_('Ui.isMenuOpen',name=>name===Menu.Main?main:name===Menu.Loading?loading:false)},
  browser:{setVisible:value=>calls.visible.push(value),setFocused:value=>calls.focused.push(value),executeJavaScript:value=>calls.scripts.push(value)},
  Game:{getPlayer:native_('Game.getPlayer',()=>({})),quitToMainMenu:native_('Game.quitToMainMenu',()=>calls.quit++),disablePlayerControls:native_('Game.disablePlayerControls',()=>calls.disabled++),enablePlayerControls:native_('Game.enablePlayerControls',()=>calls.enabled++)},printConsole(){},
  decodeUtf8:bytes=>Buffer.from(bytes).toString('utf8'),mpClientPlugin:{isConnected:()=>connected,createClient:(...args)=>{connected=true;calls.created.push(args);},
   destroyClient:()=>{assert(!insideTick,'destroyClient must not invalidate the native packet callback');connected=false;calls.destroyed++;},
   send:(...args)=>calls.sent.push(args),sendRaw:(...args)=>calls.sent.push(args),tick:fn=>{insideTick=true;try{for(const item of queue.splice(0))fn(...item);}finally{insideTick=false;}}}};
 const controller={emitter,on:(name,fn)=>native.on(name,fn),once:(name,fn)=>native.once(name,fn),lookupListener:()=>{throw Error('Unexpected world-model lookup');}};
 const network=new NetworkingService(sp,controller);
 const message=value=>queue.push(['message',new TextEncoder().encode(JSON.stringify(value)).buffer,'']);
 const custom=value=>message({t:MsgType.CustomPacket,contentJsonDump:JSON.stringify(value)});
 const setMenu=(name,open)=>native.emit(open?'menuOpen':'menuClose',{name});
 if(main)setMenu(Menu.Main,true);
 return{native,emitter,controller,network,sp,calls,queue,message,custom,main:value=>{main=value;setMenu(Menu.Main,value);},loading:value=>{loading=value;setMenu(Menu.Loading,value);},
  // The Papyrus update event does not fire while the main menu is open.
  notice:()=>storage[client.sessionNoticeKey],tick:()=>native.emit('tick'),update:()=>{if(main)return;papyrus=true;try{native.emit('update');}finally{papyrus=false;}},
  self:()=>emitter.emit('createActorMessage',{message:{isMe:true}}),action:(action,id)=>native.emit('browserMessage',{arguments:['sessionEnd:'+action,id??storage[client.sessionNoticeKey]?.id]})};
}
const clock=(start,fn)=>{const original=Date.now;let now=start;Date.now=()=>now;try{return fn({advance:ms=>now+=ms});}finally{Date.now=original;}};
const banner=(f,active)=>f.calls.scripts.includes('window.SkympSessionUi?.reconnecting('+active+')');
const dropped=()=>{const f=fixture();f.network.connect('localhost',7777);f.self();f.queue.push(['disconnect',null,'']);f.tick();return f;};
const sessionEnd=(kind,extra={})=>({customPacketType:'skymp:sessionEnd',version:1,kind,...extra});
test('server kick ends gameplay, stops transport outside its callback, and requires explicit reconnect',()=>{
 const f=fixture();f.network.connect('localhost',7777);f.self();
 f.custom(sessionEnd('kick',{message:'Server rule <img src=x onerror=alert(1)>'}));f.tick();
 assert.equal(f.notice().kind,'kick');assert.equal(f.calls.created.length,1);assert.equal(f.calls.destroyed,0);
 const before=f.calls.sent.length;f.emitter.emit('sendMessage',{message:{t:MsgType.UpdateMovement},reliability:'reliable'});assert.equal(f.calls.sent.length,before);
 f.update();assert.equal(f.calls.disabled,1);assert.equal(f.calls.quit,1);
 f.tick();assert.equal(f.calls.focused.at(-1),true);assert.equal(f.calls.destroyed,1);f.network.reconnect();assert.equal(f.calls.created.length,1);
 f.action('retry','stale');assert.equal(f.calls.created.length,1);
 f.main(true);f.action('retry');assert.equal(f.notice(),undefined);assert.equal(f.calls.created.length,2);
 f.main(false);f.update();assert.equal(f.calls.enabled,1,'controls return once the engine can run Papyrus again');
});
test('the overlay renders from tick at the main menu, where update never fires',()=>{
 const f=fixture();f.self();f.custom(sessionEnd('restart'));f.tick();f.main(true);f.tick();
 const shown=f.calls.scripts.filter(value=>value.includes('SkympSessionUi?.show')).at(-1);
 assert.equal(JSON.parse(shown.slice(shown.indexOf('(')+1,-1)).mainMenu,true);
});
test('disconnect, denied and failed before gameplay show a notice and never auto-reconnect',()=>{
 for(const [packet,kind]of[['disconnect','connectionLost'],['connectionFailed','connectionFailed'],['connectionDenied','connectionDenied']]){
  const f=fixture({main:true});f.network.connect('localhost',7777);f.queue.push([packet,null,'server full']);f.tick();f.tick();f.update();
  assert.equal(f.notice().kind,kind);assert.equal(f.calls.created.length,1);assert.equal(f.calls.quit,0);assert.equal(f.calls.destroyed,1);
 }
});
test('an invalid password stays with the auth dialog',()=>{
 const f=fixture({main:true});f.network.connect('localhost',7777);f.queue.push(['connectionDenied',null,'Invalid password']);f.tick();assert.equal(f.notice(),undefined);
});
test('close is a silent transport stop, so the login flow can connect again',()=>{
 const f=fixture({main:true});f.network.connect('localhost',7777);f.network.close();f.tick();
 assert.equal(f.notice(),undefined);assert.equal(f.calls.destroyed,1);assert.equal(f.network.isConnected(),false);
 f.network.connect('localhost',7777);assert.equal(f.calls.created.length,2);assert.equal(f.network.isConnected(),true);
});
test('a dropped connection while playing reconnects without ending the session',()=>clock(1000000,time=>{
 const f=dropped();assert.equal(f.notice(),undefined);assert(banner(f,true));assert.equal(f.calls.created.length,1);
 time.advance(1000);f.tick();assert.equal(f.calls.created.length,2);f.update();assert.equal(f.calls.quit,0);
 f.queue.push(['connectionAccepted',null,'']);f.tick();f.self();
 assert(banner(f,false));assert.equal(f.sp.storage['skymp.sessionEnd.reconnectUntil'],undefined);
 time.advance(60000);f.tick();assert.equal(f.notice(),undefined);
}));
test('failed attempts retry until the window closes, then return to the main menu',()=>clock(2000000,time=>{
 const f=dropped();
 for(let i=0;i<5;i++){time.advance(2000);f.tick();f.queue.push(['connectionFailed',null,'']);f.tick();}
 assert.equal(f.calls.created.length,6);assert.equal(f.notice(),undefined);
 time.advance(21000);f.tick();assert.equal(f.notice().kind,'connectionLost');f.update();assert.equal(f.calls.quit,1);
}));
test('server decisions end a reconnect immediately',()=>clock(3000000,time=>{
 const kicked=dropped();time.advance(1000);kicked.tick();kicked.custom(sessionEnd('kick'));kicked.tick();
 assert.equal(kicked.notice().kind,'kick');assert(banner(kicked,false));
 const denied=dropped();denied.queue.push(['connectionDenied',null,'Invalid password']);denied.tick();assert.equal(denied.notice().kind,'connectionDenied');
}));
test('close cancels a running reconnect',()=>clock(3500000,time=>{
 const f=dropped();f.network.close();time.advance(40000);f.tick();assert.equal(f.notice(),undefined);assert.equal(f.calls.created.length,1);
}));
test('ban notice preserves reason/expiry, blocks retry and dismisses only at the main menu',()=>{
 const f=fixture();f.self();const until=Date.now()+60000;
 f.custom(sessionEnd('ban',{message:'spam',until}));f.tick();
 f.action('dismiss');assert.equal(f.notice().acknowledged,false);
 f.main(true);f.action('retry');assert.equal(f.calls.created.length,0);assert.equal(f.notice().until,until);
 f.action('dismiss');assert.equal(f.notice().acknowledged,true);assert.equal(f.calls.focused.at(-1),false);f.tick();assert.equal(f.calls.created.length,0);
});
test('an expired ban can reconnect',()=>clock(4000000,time=>{
 const f=fixture({main:true});f.network.connect('localhost',7777);f.custom(sessionEnd('ban',{until:4001000}));f.tick();
 f.action('retry');assert.equal(f.calls.created.length,1);time.advance(2000);f.action('retry');assert.equal(f.calls.created.length,2);
}));
test('dismissing a kick clears the notice without connecting again',()=>{
 const f=fixture({main:true});f.network.connect('localhost',7777);f.custom(sessionEnd('kick'));f.tick();
 f.action('dismiss');assert.equal(f.notice(),undefined);assert.equal(f.calls.created.length,1);assert.equal(f.calls.visible.at(-1),false);
});
test('actions unlock when the quit to the main menu never completes',()=>clock(5000000,time=>{
 const f=fixture();f.network.connect('localhost',7777);f.self();f.custom(sessionEnd('kick'));f.tick();
 f.action('retry');assert.equal(f.calls.created.length,1);time.advance(16000);f.action('retry');assert.equal(f.calls.created.length,2);
}));
test('malformed or unrelated plugin packets do not end the session; legacy ban packets do',()=>{
 for(const packet of [{customPacketType:'skympChat:ready',version:1,kind:'ban'},{customPacketType:'skymp:sessionEnd',version:2,kind:'ban'},
  sessionEnd('arbitrary'),sessionEnd('ban',{until:-1})]){
  const f=fixture();f.custom(packet);f.tick();assert.equal(f.notice(),undefined);
 }
 const f=fixture({main:true});f.custom({customPacketType:'playerAuthResult',state:'blocked'});f.tick();assert.equal(f.notice().kind,'ban');
});
test('hot reload restores terminal state and owned controls without restarting authentication',()=>{
 const original=fixture();original.self();original.custom(sessionEnd('kick'));original.tick();original.update();
 assert.equal(original.sp.storage['skymp.sessionEnd.controlsOwned'],true);
 const restored=fixture({main:true,storage:original.sp.storage});restored.tick();
 assert.equal(restored.calls.created.length,0);assert.equal(restored.calls.quit,0);assert.equal(restored.notice().kind,'kick');
 restored.emitter.emit('browserWindowLoaded',{});assert(restored.calls.scripts.some(value=>value.includes('SkympSessionUi?.show')));
 restored.network.connect('localhost',7777);restored.main(false);restored.update();assert.equal(restored.calls.enabled,1);
});
test('hot reload resumes a running reconnect',()=>clock(6000000,time=>{
 const original=dropped();const restored=fixture({storage:original.sp.storage});time.advance(1000);restored.tick();assert.equal(restored.calls.created.length,1);
}));
test('API-1 heartbeat detects a silent server loss and tries to reconnect first',()=>clock(7000000,time=>{
 const f=fixture();f.network.connect('localhost',7777);f.self();f.tick();const ping=JSON.parse(JSON.parse(f.calls.sent[0][0]).contentJsonDump);
 f.custom({customPacketType:'skymp:sessionPong',version:1,nonce:ping.nonce});f.tick();
 for(let i=0;i<6;i++){time.advance(3000);f.tick();}
 assert.equal(f.notice(),undefined);assert(banner(f,true));
 time.advance(1000);f.tick();assert.equal(f.calls.created.length,2);
 time.advance(30000);f.tick();assert.equal(f.notice().kind,'connectionLost');f.update();assert.equal(f.calls.quit,1);
}));
test('loading screens and client stalls get a fresh heartbeat grace window',()=>clock(8000000,time=>{
 const f=fixture();f.self();f.tick();const ping=JSON.parse(JSON.parse(f.calls.sent[0][0]).contentJsonDump);
 f.custom({customPacketType:'skymp:sessionPong',version:1,nonce:ping.nonce});f.tick();
 f.loading(true);for(let i=0;i<10;i++){time.advance(3000);f.tick();}assert.equal(f.notice(),undefined);assert(!banner(f,true));
 f.loading(false);f.tick();assert(!banner(f,true));time.advance(20000);f.tick();assert(!banner(f,true));
}));
test('old servers without session pong retain native disconnect detection',()=>clock(9000000,time=>{
 const f=fixture();f.self();for(let i=0;i<12;i++){time.advance(3000);f.tick();}assert.equal(f.notice(),undefined);assert(!banner(f,true));
}));
