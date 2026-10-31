const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{EventEmitter}=require('node:events');
const {load}=require('../../console-security/tests/load-source.cjs');
const bans=load('skymp5-server/ts/adminBans.ts');
const access=load('skymp5-server/ts/playerAccess.ts');
function fixture(run){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'skymp-admission-'));assert(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep));
 return Promise.resolve().then(()=>run(directory)).finally(()=>fs.rmSync(directory,{recursive:true,force:true}));}
test('verified banned profile is rejected before actor loading or assignment; another profile can spawn',()=>fixture(async directory=>{
 bans.getAdminBans(directory).ban(2,42,null,'test ban');const ended=[],assigned=[],enabled=[];
 const settings={allSettings:{dataDir:directory},startPoints:[{}],starterInventory:{entries:[]}};
 const {Spawn}=load('skymp5-server/ts/systems/spawn.ts',{'../settings':{Settings:{get:async()=>settings}},'../adminBans':bans,'../playerSessionEnd':{endPlayerSession:(...args)=>ended.push(args)}});
 const server={getUserActor:()=>0,getActorsByProfileId:()=>[101],setEnabled:(...args)=>enabled.push(args),setUserActor:(...args)=>assigned.push(args),set(){}};
 const context={svr:server,gm:new EventEmitter()};await new Spawn(()=>{}).initAsync(context);
 context.gm.emit('spawnAllowed',9,42,[],undefined);assert.equal(ended[0][1],9);assert.equal(ended[0][2],'ban');assert.equal(ended[0][3],'test ban');assert.deepEqual(assigned,[]);assert.deepEqual(enabled,[]);
 context.gm.emit('spawnAllowed',2,43,[],undefined);assert.deepEqual(assigned,[[2,101]]);assert.deepEqual(enabled,[[101,true]]);
}));
test('blocking player access targets only live verified Steam connections, including after status is blocked',()=>fixture(directory=>{
 const steamId='76561198000000001',token='a'.repeat(64),tokenHash=crypto.createHash('sha256').update(token).digest('hex'),now=new Date().toISOString();
 const settings={dataDir:directory,playerAccess:{mode:'guest'}};
 fs.writeFileSync(path.join(directory,'player-access.json'),JSON.stringify({version:1,nextProfileId:2000000001,
  principals:{['steam:'+steamId]:{id:'steam:'+steamId,profileId:2000000000,status:'approved',name:'Tester',createdAt:now,lastSeenAt:now}},
  sessions:{[tokenHash]:{steamId,expires:Date.now()+60000}},tickets:{},accounts:{}}));
 let guid='one';const server={isConnected:id=>id===1,getUserGuid:()=>guid,sendCustomPacket(){}};
 const session=new access.SteamPlayerSessions(()=>settings,()=>{});session.handle(1,'loginWithSteam',{steamSession:token},{svr:server});
 assert.deepEqual(access.getVerifiedSteamUsers(server,steamId),[1]);access.changePlayerAccess(settings,'steam:'+steamId,'block');
 assert.deepEqual(access.getSteamPlayerInfo(server,1),{});assert.deepEqual(access.getVerifiedSteamUsers(server,steamId),[1]);
 guid='reused';assert.deepEqual(access.getVerifiedSteamUsers(server,steamId),[]);
}));
test('player-access API invokes active-session termination only after an authorized same-origin block',()=>fixture(directory=>{
 const steamId='76561198000000002',now=new Date().toISOString(),settings={dataDir:directory};
 fs.writeFileSync(path.join(directory,'player-access.json'),JSON.stringify({version:1,nextProfileId:2000000001,
  principals:{['steam:'+steamId]:{id:'steam:'+steamId,profileId:2000000000,status:'approved',name:'Tester',createdAt:now,lastSeenAt:now}},sessions:{},tickets:{},accounts:{}}));
 const posts=new Map(),blocked=[];
 access.registerPlayerAccess({post:(route,fn)=>posts.set(route,fn),get(){}},{settings:()=>settings,authorize:ctx=>ctx.allowed===true,onBlocked:entry=>blocked.push(entry.id)});
 const context=(allowed,origin)=>({allowed,host:'admin.test',request:{body:{id:'steam:'+steamId,action:'block'}},set(){},get:key=>key==='origin'?origin:key==='content-type'?'application/json':''});
 const handler=posts.get('/api/admin/player-access');handler(context(false,'https://admin.test'));handler(context(true,'https://evil.test'));assert.equal(blocked.length,0);
 handler(context(true,'https://admin.test'));assert.deepEqual(blocked,['steam:'+steamId]);assert.equal(access.listPlayerAccess(settings)[0].status,'blocked');
}));
