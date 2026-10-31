const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {load}=require('./load-source.cjs');
const {inspectConsoleSecurity,validateConsoleSecuritySettings,consoleSecurityDefaults,ConsoleSecurityService,registerConsoleSecurity}=load('skymp5-server/ts/consoleSecurity.ts');
test('missing, invalid and legacy configuration defaults to restricted without bypass',()=>{
  assert.deepEqual(inspectConsoleSecurity({}).policy,consoleSecurityDefaults);
  assert.equal(inspectConsoleSecurity({enableConsoleCommandsForAll:true}).policy.blockUnauthorizedServerCommands,true);
  for(const value of [null,[],false,'development'])assert(validateConsoleSecuritySettings({consoleSecurity:value}));
  for(const value of [{mode:'invalid'},{mode:'restricted',blockVanillaCheats:false},{blockUnauthorizedServerCommands:false},{unexpected:true},JSON.parse('{"__proto__":true}')])assert(validateConsoleSecuritySettings({consoleSecurity:value}));
  assert.equal(inspectConsoleSecurity({consoleSecurity:{mode:'invalid',blockVanillaCheats:false}}).policy.blockVanillaCheats,true);
  assert.equal(validateConsoleSecuritySettings({enableConsoleCommandsForAll:true,consoleSecurity:consoleSecurityDefaults}),null);
  const development=inspectConsoleSecurity({consoleSecurity:{mode:'development',blockVanillaCheats:false}}).policy;
  assert.equal(development.blockVanillaCheats,false);assert.equal(development.blockUnauthorizedServerCommands,true);
});
function routes(initial={},active=consoleSecurityDefaults){
  let settings=structuredClone(initial),writes=0;const handlers={},logs=[];
  registerConsoleSecurity({get:(route,fn)=>handlers.GET=fn,put:(route,fn)=>handlers.PUT=fn},{read:()=>structuredClone(settings),write:value=>{settings=value;writes++;},authorize:(ctx)=>{if(!ctx.authorized){ctx.status=403;return false;}return true;},status:()=>active?{nativeSupported:true,active:{policy:active},reports:[]}:null,log:line=>logs.push(line)});
  const context=(body={},extra={})=>({authorized:true,host:'dashboard.test',request:{body},get:name=>({'origin':'http://dashboard.test','content-type':'application/json','sec-fetch-site':'same-origin',...extra}[name]??''),set(){}});
  const get=()=>{const ctx=context();handlers.GET(ctx);return ctx.body;};
  return {handlers,context,get,settings:()=>settings,writes:()=>writes,logs,replace:value=>settings=structuredClone(value)};
}
test('dashboard shows active native policy independently of saved policy and object key order',()=>{
  const sorted=Object.fromEntries(Object.entries(consoleSecurityDefaults).sort());
  const api=routes({consoleSecurity:consoleSecurityDefaults},sorted);assert.equal(api.get().restartRequired,false);
  const stopped=routes({},null).get();assert.equal(stopped.active,null);assert.equal(stopped.restartRequired,null);assert.equal(stopped.clientProtectionVerified,false);
  const ctx=api.context({revision:api.get().revision,consoleSecurity:{...consoleSecurityDefaults,mode:'development',blockVanillaCheats:false}});api.handlers.PUT(ctx);
  assert.equal(ctx.body.restartRequired,true);assert.equal(ctx.body.active.mode,'restricted');assert.equal(ctx.body.saved.mode,'development');
});
test('security write preserves latest unrelated private settings and refuses stale edits',()=>{
  const api=routes({private:{token:'DO_NOT_LOG'},loadOrder:['Skyrim.esm'],consoleSecurity:consoleSecurityDefaults}),revision=api.get().revision;
  api.replace({...api.settings(),outsideChange:'preserved'});
  const ctx=api.context({revision,consoleSecurity:{...consoleSecurityDefaults,logViolations:false}});api.handlers.PUT(ctx);
  assert.equal(api.settings().private.token,'DO_NOT_LOG');assert.equal(api.settings().outsideChange,'preserved');assert(!JSON.stringify(api.logs).includes('DO_NOT_LOG'));
  const stale=api.context({revision,consoleSecurity:consoleSecurityDefaults});api.handlers.PUT(stale);assert.equal(stale.status,409);assert.equal(api.writes(),1);
});
test('dashboard denies unauthorized, cross-origin and malformed writes without side effects',()=>{
  const api=routes({consoleSecurity:consoleSecurityDefaults}),body={revision:api.get().revision,consoleSecurity:consoleSecurityDefaults};
  for(const extra of [{origin:''},{origin:'https://evil.test'},{'content-type':'text/plain'},{'sec-fetch-site':'cross-site'}]){const ctx=api.context(body,extra);api.handlers.PUT(ctx);assert.equal(ctx.status,403);}
  const denied=api.context(body);denied.authorized=false;api.handlers.PUT(denied);assert.equal(denied.status,403);
  for(const value of [{...body,admin:true},{...body,consoleSecurity:{blockUnauthorizedServerCommands:false}},{...body,consoleSecurity:{mode:'invalid'}}]){const ctx=api.context(value);api.handlers.PUT(ctx);assert.equal(ctx.status,400);}
  assert.equal(api.writes(),0);
});
function native(){
  const server=new EventEmitter(),sent=[];let resolver=null;
  Object.assign(server,{isConnected:id=>id===7,getUserActor:id=>id===7?123:0,getUserByActor:id=>id===123?7:65535,get:(_id,key)=>key==='profileId'?42:false,
    getConsoleSecurityState:()=>({apiVersion:1,serverAuthorization:'enforced',policy:{...consoleSecurityDefaults},diagnostics:[],authenticated:true,allowedServerCommands:[]}),
    setConsoleCommandAuthorizer:callback=>resolver=callback,grantMovementAllowance:(...args)=>sent.push(args),sendCustomPacket:(userId,raw)=>sent.push({userId,...JSON.parse(raw)})});
  return {server,sent,resolver:()=>resolver};
}
test('Core works without Chat and never trusts claimed client roles or actor IDs',()=>{
  const f=native(),service=new ConsoleSecurityService(f.server,{});
  f.server.emit('customPacket',7,JSON.stringify({customPacketType:'consoleSecurity:hello',apiVersion:1,requestId:'fresh',actorId:999,admin:true,allowedServerCommands:['additem']}));
  assert.equal(f.sent[0].userId,7);assert.deepEqual(f.sent[0].allowedServerCommands,[]);assert.equal(service.api.hasPermission(7,'console.additem'),false);
  f.server.emit('customPacket',99,JSON.stringify({customPacketType:'consoleSecurity:hello',apiVersion:1,requestId:'fresh'}));assert.equal(f.sent.length,1);
  assert.equal(service.status().nativeSupported,true);assert.equal(service.status().clientProtectionVerified,false);
});
test('optional permission resolver is owned, synchronous, fail-closed and reset on gamemode reload',()=>{
  const f=native(),service=new ConsoleSecurityService(f.server,{});
  service.api.setPermissionResolver('roles',ctx=>ctx.userId===7&&ctx.actorId===123&&ctx.permission==='chat.example');
  assert(service.api.hasPermission(7,'chat.example'));assert(!service.api.hasPermission(99,'chat.example'));
  assert.throws(()=>service.api.setPermissionResolver('other',()=>true));
  service.api.setPermissionResolver('roles',async()=>true);assert.equal(service.api.hasPermission(7,'chat.example'),false);
  service.api.setPermissionResolver('roles',()=>{throw Error('fail');});assert.equal(service.api.hasPermission(7,'chat.example'),false);
  service.resetPermissions();assert.equal(service.api.hasPermission(7,'chat.example'),false);
  assert.equal(f.resolver()({userId:7,actorId:123,profileId:42,targetId:123,permission:'console.additem',source:'native_console'}),null);
});
test('client status reports remain unverified and cannot alter native authorization',()=>{
  const f=native(),logs=[],service=new ConsoleSecurityService(f.server,{},line=>logs.push(line));
  const report={customPacketType:'consoleSecurity:report',apiVersion:1,supported:['tcl'],unsupported:['tim'],actorId:999,admin:true};
  f.server.emit('customPacket',7,JSON.stringify(report));assert.equal(service.status().reports[0].userId,7);assert.equal(service.status().reports[0].trust,'client_report_unverified');
  assert.deepEqual(f.server.getConsoleSecurityState().allowedServerCommands,[]);
  const blocked={customPacketType:'consoleSecurity:blocked',apiVersion:1,command:'tcl'};
  f.server.emit('customPacket',7,JSON.stringify(blocked));assert(logs.some(line=>line.includes('"blocked":false')&&line.includes('client_report')));
  f.server.emit('disconnect',7);assert.equal(service.status().reports.length,0);
});
test('server-only movement allowance is bounded and requires native support',()=>{
  const f=native(),service=new ConsoleSecurityService(f.server,{});
  for(const value of [-1,30001,NaN,Infinity,0.5])assert.throws(()=>service.api.grantMovementAllowance(123,value));
  service.api.grantMovementAllowance(123,5000);assert.deepEqual(f.sent[0],[123,5000]);
});
