const { test }=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {load}=require('./source-loader.cjs');
const {readAdminInventory,requireOnlinePlayer}=load('skymp5-server/ts/adminInventory.ts');
const server={getUserActor:()=>0,getActorsByProfileId:()=>[],get:()=>{throw Error('no actor');}};
test('offline inventory uses world/changeForms and stable profile, including empty inventories',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'skymp-inventory-')),old=process.cwd();
  fs.mkdirSync(path.join(dir,'world/changeForms'),{recursive:true});fs.mkdirSync(path.join(dir,'data/changeForms'),{recursive:true});
  const file=path.join(dir,'world/changeForms/ff000001.json');fs.writeFileSync(file,JSON.stringify({profileId:2000000001,formDesc:'ff000001:Skyrim.esm',inv:{entries:[]}}));
  fs.writeFileSync(path.join(dir,'data/changeForms/decoy.json'),JSON.stringify({profileId:1,inv:{entries:[{baseId:99}]}}));const before=fs.readFileSync(file);
  try {process.chdir(dir);
    const value=await readAdminInventory({server,settings:{dataDir:'data'},userId:1,online:false,profileId:2000000001});
    assert.equal(value.source,'offline-file');assert.equal(value.entryCount,0);assert.equal(value.profileId,2000000001);
    await assert.rejects(readAdminInventory({server,settings:{},userId:1,online:false,profileId:null}),{code:'PROFILE_NOT_RESOLVED'});
    await assert.rejects(readAdminInventory({server,settings:{},userId:1,online:false,profileId:1}),{code:'INVENTORY_NOT_SAVED'});
    assert.deepEqual(fs.readFileSync(file),before);
  }finally{process.chdir(old);fs.rmSync(dir,{recursive:true,force:true});}
});
test('configured databaseName and unavailable drivers have explicit results',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'skymp-inventory-custom-'));fs.mkdirSync(path.join(dir,'changeForms'));
  fs.writeFileSync(path.join(dir,'changeForms/save.json'),JSON.stringify({profileId:42,inv:{entries:[{baseId:10,count:2}]}}));
  try{assert.equal((await readAdminInventory({server,settings:{databaseName:dir},userId:3,online:false,profileId:42})).entryCount,1);
    await assert.rejects(readAdminInventory({server,settings:{databaseDriver:'mongo'},userId:3,online:false,profileId:42}),{code:'INVENTORY_STORAGE_UNSUPPORTED'});
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('live/native offline actor inventory must match the stable profile',async()=>{
  const native={getUserActor:()=>100,getActorsByProfileId:()=>[100],get:(id,key)=>key==='profileId'?42:{entries:[{baseId:11}]}};
  assert.equal((await readAdminInventory({server:native,settings:{},userId:1,online:true,profileId:null})).source,'online');
  assert.equal((await readAdminInventory({server:native,settings:{},userId:1,online:false,profileId:42,lastActorId:100})).source,'offline-memory');
});
test('moderation rejects offline slots and reused connections before recording success',()=>{
  const ctx={params:{userId:'1'},request:{body:{expectedProfileId:42}}};
  assert.equal(requireOnlinePlayer(ctx,[],()=>42),false);assert.equal(ctx.body.code,'PLAYER_OFFLINE');
  assert.equal(requireOnlinePlayer(ctx,[1],()=>99),false);assert.equal(ctx.body.code,'PLAYER_SESSION_CHANGED');
  assert.equal(requireOnlinePlayer(ctx,[1],()=>42),true);
});
