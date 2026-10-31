const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {load}=require('./load-source.cjs');
const {ConsoleSecurityClient}=load('skymp5-client/src/services/services/consoleSecurityClient.ts',{'../../messages':{MsgType:{CustomPacket:1}}});
const bindings={'../../messages':{MsgType:{CustomPacket:1,ConsoleCommand:2}},'../../logging':{logError(){},logTrace(){}},'../../view/worldViewMisc':{localIdToRemoteId:id=>id},'./clientListener':{ClientListener:class{}},'./consoleSecurityClient':{ConsoleSecurityClient}};
const {ConsoleCommandsService}=load('skymp5-client/src/services/services/consoleCommandsService.ts',bindings);
const names={tcl:'ToggleCollision',tgm:'ToggleGodMode',tim:'ToggleImmortalMode',modav:'ModActorValue',setav:'SetActorValue',forceav:'ForceActorValue',setlevel:'SetLevel',coc:'CenterOnCell',moveto:'MoveTo',kill:'Kill',resurrect:'Resurrect',enable:'Enable',unlock:'Unlock',additem:'AddItem',equipitem:'EquipItem',placeatme:'PlaceAtMe',disable:'Disable',test:'test'};
function harness(missing=[],previous=()=>true){
  const commands=new Map(),handlers=new Map(),emitter=new EventEmitter(),sent=[],prints=[],calls=[];
  for(const [shortName,longName]of Object.entries(names)){if(missing.includes(shortName))continue;const command={shortName,longName,execute:previous};commands.set(shortName,command);commands.set(longName.toLowerCase(),command);}
  const sp={settings:{},storage:{},findConsoleCommand:name=>{calls.push(name);return commands.get(name.toLowerCase())??null;},printConsole:line=>prints.push(line)};
  const controller={emitter,on:(name,callback)=>handlers.set(name,callback)};emitter.on('sendMessage',value=>sent.push(value.message));
  const service=new ConsoleCommandsService(sp,controller);
  const packet=value=>emitter.emit('customPacketMessage',{message:{contentJsonDump:JSON.stringify(value)}});
  const update=()=>handlers.get('update')();
  const join=()=>{emitter.emit('connectionAccepted',{});emitter.emit('createActorMessage',{message:{isMe:true}});update();return JSON.parse(sent.at(-1).contentJsonDump).requestId;};
  const policy=(requestId,extra={})=>packet({customPacketType:'consoleSecurity:policy',apiVersion:1,requestId,policy:{mode:'restricted',blockVanillaCheats:true,blockUnauthorizedServerCommands:true},allowedServerCommands:[],...extra});
  return{sp,controller,commands,sent,prints,calls,service,packet,join,policy,update};
}
test('native cheats and aliases are blocked while harmless commands remain untouched',()=>{
  const h=harness();h.join();for(const name of ['tcl','tgm','tim','modav','setav','forceav','setlevel','coc','moveto','kill','resurrect','enable','unlock'])assert.equal(h.commands.get(name).execute(0x14,'value'),false,name);
  assert.equal(h.commands.get('togglegodmode').execute(0x14),false);assert(!h.calls.includes('help'));assert(!h.calls.includes('mp'));
});
test('a fresh server policy authorizes native requests, never local vanilla execution',()=>{
  const h=harness(),id=h.join();h.policy(id,{allowedServerCommands:['additem','disable']});h.sent.length=0;
  assert.equal(h.commands.get('additem').execute(0x14,0x12eb7,1),false);
  assert.equal(h.sent[0].t,2);assert.deepEqual(h.sent[0].data,{commandName:'additem',args:[0x14,0x12eb7,1]});
  h.sent.length=0;h.commands.get('additem').execute(0x14,0x12eb7,-1);assert.equal(h.sent.length,0);
  h.commands.get('test').execute(0x14,'unknown');assert.equal(h.sent.length,0);
});
test('stale policies, disconnects and actor replacement cannot retain client command permissions',()=>{
  const h=harness(),id=h.join();h.policy('old_session',{allowedServerCommands:['additem']});h.sent.length=0;h.commands.get('additem').execute(0x14,1,1);assert(!h.sent.some(value=>value.t===2));
  h.policy(id,{allowedServerCommands:['additem']});h.controller.emitter.emit('connectionDisconnect',{});h.sent.length=0;h.commands.get('additem').execute(0x14,1,1);assert(!h.sent.some(value=>value.t===2));
});
test('a policy reply slower than the hello interval is accepted once, and older ids expire with it',()=>{
  const originalNow=Date.now;let now=1000000;Date.now=()=>now;
  try{
    const h=harness(),slow=h.join();now+=1500;h.update();const newest=JSON.parse(h.sent.at(-1).contentJsonDump).requestId;assert.notEqual(slow,newest);
    h.policy(newest,{allowedServerCommands:['additem']});h.policy(slow,{allowedServerCommands:[]});
    h.sent.length=0;h.commands.get('additem').execute(0x14,1,1);assert(h.sent.some(value=>value.t===2),'stale reply must not replace the newer policy');
    const lagging=harness(),first=lagging.join();now+=1500;lagging.update();
    lagging.policy(first,{allowedServerCommands:['additem']});lagging.sent.length=0;lagging.commands.get('additem').execute(0x14,1,1);assert(lagging.sent.some(value=>value.t===2));
  }finally{Date.now=originalNow;}
});
test('development can allow vanilla but preserves existing handlers and server authorization',()=>{
  let previousCalls=0;const h=harness([],()=>{previousCalls++;return true;}),id=h.join();
  h.policy(id,{policy:{mode:'development',blockVanillaCheats:false,blockUnauthorizedServerCommands:true}});
  assert.equal(h.commands.get('tgm').execute(0),true);assert.equal(previousCalls,1);
  h.sent.length=0;h.commands.get('additem').execute(0x14,1,1);assert(!h.sent.some(value=>value.t===2));
  const veto=harness([],()=>false),vetoId=veto.join();veto.policy(vetoId,{policy:{mode:'development',blockVanillaCheats:false,blockUnauthorizedServerCommands:true}});assert.equal(veto.commands.get('tgm').execute(0),false);
});
test('unsupported native commands are reported without a false protection claim',()=>{
  const h=harness(['tim','unlock']);const report=h.sp.storage.consoleSecurityClient;
  assert(report.unsupported.includes('tim'));assert(report.unsupported.includes('unlock'));assert(!report.supported.includes('tim'));assert.equal(report.verifiedByServer,false);
});
