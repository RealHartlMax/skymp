const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {load}=require('../../console-security/tests/load-source.cjs');
const {AdminBans,banConnectedPlayer,getAdminBans}=load('skymp5-server/ts/adminBans.ts');
function fixture(run){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'skymp-bans-'));assert(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep));
 try{return run(directory,path.join(directory,'admin-bans.json'));}finally{fs.rmSync(directory,{recursive:true,force:true});}}
test('profile ban survives store reload and does not ban a recycled connection slot',()=>fixture((directory,file)=>{
 const bans=new AdminBans(file);bans.ban(1,42,null,'griefing');
 const restored=new AdminBans(file);assert.equal(restored.forProfile(42).reason,'griefing');assert.equal(restored.forProfile(43),null);
 const server={isConnected:id=>id===1,getUserActor:()=>101,getUserByActor:()=>1,get:()=>43};
 banConnectedPlayer(server,directory,1,Date.now()+60000,'other profile');assert.equal(getAdminBans(directory).list().length,2);
 assert.throws(()=>getAdminBans(directory).remove('1'),/Ambiguous/);
 assert(getAdminBans(directory).remove('profile:42'));assert.equal(getAdminBans(directory).forProfile(42),null);assert(getAdminBans(directory).forProfile(43));
}));
test('legacy arrays remain visible and are never treated as authenticated profile bans',()=>fixture((directory,file)=>{
 fs.writeFileSync(file,JSON.stringify([[1,null],[2,Date.now()+60000]]));const bans=new AdminBans(file);
 assert.equal(bans.list().length,2);assert.equal(bans.forProfile(1),null);assert.equal(bans.forProfile(2),null);
 assert.equal(JSON.parse(fs.readFileSync(file)).length,2,'read does not rewrite operator data');
 bans.ban(3,42,null,'new');const stored=JSON.parse(fs.readFileSync(file));assert.equal(stored.version,2);assert.equal(stored.bans.length,3);
 assert(bans.remove('legacy:1'));assert.equal(bans.list().length,2);
}));
test('expired and revoked bans no longer block profile admission',()=>fixture((directory,file)=>{
 const bans=new AdminBans(file);bans.ban(1,42,Date.now()-1,'expired');assert.equal(bans.forProfile(42),null);
 bans.ban(1,42,null,'permanent');assert(bans.forProfile(42));assert(bans.remove('profile:42'));assert.equal(new AdminBans(file).forProfile(42),null);
}));
test('invalid or unowned identities cannot create a ban',()=>fixture((directory,file)=>{
 const bans=new AdminBans(file);for(const id of [-1,NaN,0.5,2147483648])assert.throws(()=>bans.ban(1,id,null,'invalid'));
 assert.throws(()=>banConnectedPlayer({getUserActor:()=>101,isConnected:()=>true,getUserByActor:()=>9,get:()=>42},directory,1,null,'invalid'));
 assert.equal(bans.list().length,0);assert(!fs.existsSync(file));
}));
test('a failed atomic write rolls back the in-memory ban',()=>fixture((directory,file)=>{
 const bans=new AdminBans(file);fs.mkdirSync(file);assert.throws(()=>bans.ban(1,42,null,'cannot save'));assert.equal(bans.list().length,0);
 assert.equal(fs.readdirSync(directory).length,1);
}));
