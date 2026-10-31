const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');
const requireServer = createRequire(path.resolve(__dirname,'../../skymp5-server/package.json'));
const Koa = requireServer('koa'), Router = requireServer('koa-router'), koaBody = requireServer('koa-body');
const connection = require('../deploy/test-server/launcher-connection.cjs');
const { configure } = require('../deploy/test-server/setup-server.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(),'skymp-launcher-form-'));
const file = path.join(root,'server-settings.json');
const privateKey = 'skymp_live_only_for_fixture_123456789';
const base = { name:'ÄÖÜ World', offlineMode:true, master:'https://api.skymp-worlds.net', masterKey:privateKey,
  port:7777, loadOrder:['Skyrim.esm'], world:{keep:42}, adminUiMasterUser:'owner',
  launcherResources:{enabled:true,runtimeSource:connection.DEFAULT_RUNTIME,custom:'preserve'} };
const fields = { master:connection.DEFAULT_MASTER, serverUid:'srv_public_fixture', masterKey:privateKey,
  authMode:'online',publicHost:'203.0.113.10',port:'7777',resourcesEnabled:true,
  runtimeSource:connection.DEFAULT_RUNTIME };
const checks = [];
let server;
(async()=>{
 try {
  fs.writeFileSync(file,JSON.stringify(base));
  for (const invalid of [
    {master:'javascript:alert(1)'},{master:'https://user:secret@example.com'},{master:'https://example.com/path'},
    {serverUid:'../key'},{serverUid:''},{masterKey:'bad key'},{masterKey:[]},{authMode:'anything'},
    {publicHost:'http://127.0.0.1:8080/'},{publicHost:'999.999.999.999'},{publicHost:'0.0.0.0'},
    {port:0},{port:65536},{port:'1.2'},{resourcesEnabled:'true'},
    
    {runtimeSource:'https://example.com/not-a-manifest.zip'},
  ]) {
    assert.throws(()=>connection.save(file,{...fields,...invalid,revision:connection.describe(base).revision}));
    assert.deepEqual(connection.read(file),base);
  }
  checks.push('Typed URL, identity, key, host, port, resource and runtime validation; invalid submissions preserve settings');
  const app=new Koa(), router=new Router();
  app.use(koaBody({jsonLimit:'16kb'}));
  app.use(async(ctx,next)=>{
    if(ctx.get('authorization')!=='Bearer fixture-admin' && ctx.get('authorization')!=='Bearer fixture-viewer') {ctx.status=401;return;}
    await next();
  });
  connection.register(router,{file:()=>file,authorize:ctx=>{if(ctx.get('authorization')!=='Bearer fixture-admin'){ctx.status=403;return false;}return true;}});
  app.use(router.routes()).use(router.allowedMethods());
  server=await new Promise(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));});
  const origin='http://127.0.0.1:'+server.address().port, endpoint=origin+'/api/admin/launcher-connection';
  const headers={'authorization':'Bearer fixture-admin','content-type':'application/json',origin};
  assert.equal((await fetch(endpoint)).status,401);
  assert.equal((await fetch(endpoint,{headers:{authorization:'Bearer fixture-viewer'}})).status,403);
  let response=await fetch(endpoint,{headers});let data=await response.json();
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert(data.hasMasterKey);assert(!JSON.stringify(data).includes(privateKey));assert(!('masterKey' in data));
  const submission={...fields,revision:data.revision};
  assert.equal((await fetch(endpoint,{method:'POST',headers:{...headers,origin:'https://attacker.example'},body:JSON.stringify(submission)})).status,403);
  assert.equal((await fetch(endpoint,{method:'POST',headers:{...headers,'content-type':'text/plain'},body:JSON.stringify(submission)})).status,403);
  checks.push('HTTP authentication, admin role, same-origin JSON writes and secret-free no-store responses');
  response=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify(submission)});assert.equal(response.status,200);
  data=await response.json();assert(data.restartRequired);assert(!JSON.stringify(data).includes(privateKey));
  const saved=connection.read(file);assert.equal(saved.offlineMode,false);assert.equal(saved.serverUid,fields.serverUid);
  assert.deepEqual(saved.world,base.world);assert.deepEqual(saved.loadOrder,base.loadOrder);
  assert.equal(saved.launcherResources.custom,'preserve');assert.equal(saved.adminUiMasterUser,'owner');
  const backup=fs.readdirSync(root).find(name=>name.startsWith('server-settings.json.before-launcher-'));
  assert(backup);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,backup),'utf8')),base);
  assert.equal((await fetch(endpoint,{method:'POST',headers,body:JSON.stringify(submission)})).status,409);
  response=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({...submission,revision:data.revision,masterKey:'',runtimeSource:''})});
  assert.equal(response.status,200);assert.equal(connection.read(file).masterKey,privateKey);assert.equal(connection.read(file).launcherResources.runtimeSource,'');
  checks.push('Atomic merged save, private backup, stale form conflict, blank-key preservation and explicit empty runtime');
  const setupRoot=path.join(root,'setup');fs.mkdirSync(setupRoot);
  fs.writeFileSync(path.join(setupRoot,'server-settings.json'),JSON.stringify({...base,dataDir:'data'}));
  configure(setupRoot,{serverName:'Configured',port:7777,uiPort:8080,maxPlayers:16,access:'public',publicHost:'203.0.113.10',adminUser:'owner',password:'Only-fixture-password-2026',passwordConfirm:'Only-fixture-password-2026',launcher:fields});
  const setupSettings=JSON.parse(fs.readFileSync(path.join(setupRoot,'server-settings.json'),'utf8'));
  assert.equal(setupSettings.offlineMode,false);assert.equal(setupSettings.serverUid,fields.serverUid);assert.equal(setupSettings.publicHost,'203.0.113.10');assert.deepEqual(setupSettings.world,base.world);
  const client=JSON.parse(fs.readFileSync(path.join(setupRoot,'skymp5-client-settings.example.txt'),'utf8'));
  assert.equal(client.master,fields.master);assert.equal(client['server-master-key'],fields.serverUid);assert(!JSON.stringify(client).includes(privateKey));
  checks.push('First-time setup applies online connection fields and never exports a private server key to players');
  const latest=connection.read(file), lock=file+'.write-lock';
  fs.writeFileSync(lock,JSON.stringify({pid:process.pid}));
  assert.throws(()=>connection.save(file,{...fields,revision:connection.describe(latest).revision}),/being changed/);
  assert.deepEqual(connection.read(file),latest);fs.unlinkSync(lock);
  fs.writeFileSync(lock,'');fs.utimesSync(lock,new Date(Date.now()-60000),new Date(Date.now()-60000));
  connection.save(file,{...fields,revision:connection.describe(latest).revision});
  assert(!fs.existsSync(lock));
  checks.push('Interrupted empty write locks recover; a live writer remains protected');
  const report={ok:true,date:new Date().toISOString(),checks,gameServerStarted:false,temporaryRoot:root};
  console.log(JSON.stringify(report,null,2));
  if(process.env.SKYMP_FORM_REPORT) fs.writeFileSync(process.env.SKYMP_FORM_REPORT,JSON.stringify(report,null,2)+'\n');
 } finally {if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
