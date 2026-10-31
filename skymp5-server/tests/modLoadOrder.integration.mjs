import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const serverRoot=process.env.SKYMP_SERVER_MODULE_ROOT||fileURLToPath(new URL('..',import.meta.url));
const require=createRequire(path.join(serverRoot,'package.json'));
const root=fs.mkdtempSync(path.join(os.tmpdir(),'skymp-mod-order-'));
const bundle=process.env.SKYMP_MOD_ORDER_BUNDLE||path.join(root,'mod-order.cjs');
if(!process.env.SKYMP_MOD_ORDER_BUNDLE)require('esbuild').buildSync({entryPoints:[path.join(serverRoot,'ts/modLoadOrder.ts')],outfile:bundle,bundle:true,platform:'node',target:'es2022',logLevel:'silent'});
const api=require(bundle),Koa=require('koa'),Router=require('koa-router'),body=require('koa-body');
export function makePlugin(masters=[],master=false){
 const sub=(name,data)=>{const header=Buffer.alloc(6);header.write(name);header.writeUInt16LE(data.length,4);return Buffer.concat([header,data]);};
 const hedr=Buffer.alloc(12);hedr.writeFloatLE(1.7);const data=Buffer.concat([sub('HEDR',hedr),...masters.flatMap(name=>[sub('MAST',Buffer.from(name+'\0')),sub('DATA',Buffer.alloc(8))])]);
 const record=Buffer.alloc(24);record.write('TES4');record.writeUInt32LE(data.length,4);record.writeUInt32LE(master?1:0,8);return Buffer.concat([record,data]);
}
let server;const checks=[];
const baseFiles=['Skyrim.esm','Update.esm','Dawnguard.esm','HearthFires.esm','Dragonborn.esm'];
try{
 const data=path.join(root,'data'),publication=path.join(root,'data/mods/Community');fs.mkdirSync(publication,{recursive:true});
 for(const [index,name]of baseFiles.entries())fs.writeFileSync(path.join(data,name),makePlugin(index?['Skyrim.esm']:[],true));
 for(const [name,masters,master]of [['Skyrim.esm',[],true],['World.esm',['Skyrim.esm'],true],['Alpha.esp',['World.esm'],false],['Patch.esp',['Alpha.esp'],false],['Unused.esl',['Skyrim.esm'],true]])fs.writeFileSync(path.join(data,name),makePlugin(masters,master));
 fs.writeFileSync(path.join(data,'broken.esp'),'corrupt');fs.writeFileSync(path.join(data,'Unrelated.dll'),'not a mod');fs.writeFileSync(path.join(publication,'FolderMod.esp'),makePlugin(['Skyrim.esm']));
 fs.mkdirSync(path.join(data,'nested'));fs.writeFileSync(path.join(data,'nested/NotDirect.esp'),makePlugin());
 const cfg=path.join(root,'server-settings.json');const settings={loadOrder:[...baseFiles,'World.esm','Alpha.esp','Patch.esp'],dataDir:data,launcherResources:{runtimeSource:'https://fixture.invalid/catalog.json'},masterKey:'PRIVATE_FIXTURE_KEEP',other:{keep:true}};
 fs.writeFileSync(cfg,JSON.stringify(settings));fs.writeFileSync(path.join(data,'manifest.json'),JSON.stringify({loadOrder:settings.loadOrder}));
 const read=()=>JSON.parse(fs.readFileSync(cfg,'utf8'));let writes=0,injectLatest=false,reads=0;
 const router=new Router();api.registerModLoadOrder(router,{read:()=>{reads++;if(injectLatest&&reads===2){const current=read();current.other.updated=true;fs.writeFileSync(cfg,JSON.stringify(current));}return read();},write:value=>{writes++;fs.writeFileSync(cfg,JSON.stringify(value));},authorize:(ctx,write)=>{if(ctx.get('x-test-role')==='admin'||!write&&ctx.get('x-test-role')==='viewer')return true;ctx.status=403;ctx.body={ok:false};return false;}});
 const app=new Koa();app.use((body.default||body)({jsonLimit:'2mb'}));app.use(router.routes());server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const get=role=>fetch(origin+'/api/admin/resources/load-order',{headers:{'x-test-role':role||'admin'}});
 const post=(value,role='admin',site=origin)=>fetch(origin+'/api/admin/resources/load-order',{method:'POST',headers:{'Content-Type':'application/json',Origin:site,'x-test-role':role},body:JSON.stringify(value)});
 let response=await get(),snapshot=await response.json();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(snapshot.restartRequired,false);
 assert.deepEqual(snapshot.baseLoadOrder,baseFiles);
 assert.deepEqual(snapshot.loadOrder,settings.loadOrder);assert(snapshot.entries.some(entry=>entry.name==='Unused.esl'));assert(!snapshot.entries.some(entry=>entry.name==='Unrelated.dll'||entry.name==='NotDirect.esp'));
 assert.equal(snapshot.entries.find(entry=>entry.name==='broken.esp').issue,'invalid');assert.equal(snapshot.entries.find(entry=>entry.name==='FolderMod.esp').folder,'Community');assert.equal(snapshot.modFolders[0].name,'Community');assert(!JSON.stringify(snapshot).includes(settings.masterKey));
 checks.push('Automatic direct-directory ESM/ESP/ESL discovery, TES4 masters, inactive uploads, mod folders and invalid status; no secrets or unrelated files');
 const order=[...baseFiles,'World.esm','Unused.esl','Alpha.esp','Patch.esp'];response=await post({revision:snapshot.revision,loadOrder:order.slice(baseFiles.length)});assert.equal(response.status,200,await response.clone().text());snapshot=await response.json();assert.equal(snapshot.restartRequired,true);assert.deepEqual(read().loadOrder,order);assert.equal(read().masterKey,settings.masterKey);assert.deepEqual(read().other,{keep:true});
 response=await post({revision:snapshot.revision,loadOrder:['World.esm','skyrim.esm','Unused.esl','Alpha.esp','Update.esm','Patch.esp']});assert.equal(response.status,200,await response.clone().text());snapshot=await response.json();assert.deepEqual(read().loadOrder,order);
 checks.push('The five required game files are separate from editable mods and cannot be removed or reordered through mod-only or legacy full-order API requests');
 fs.writeFileSync(path.join(data,'manifest.json'),JSON.stringify({loadOrder:order}));assert.equal((await (await get()).json()).restartRequired,false);
 fs.writeFileSync(path.join(data,'NewUpload.esp'),makePlugin(['Skyrim.esm']));const unchanged=fs.readFileSync(cfg,'utf8');response=await post({revision:snapshot.revision,loadOrder:order});assert.equal(response.status,409);assert.equal(fs.readFileSync(cfg,'utf8'),unchanged);snapshot=await (await get()).json();assert(snapshot.entries.some(entry=>entry.name==='NewUpload.esp'));
 checks.push('Saving updates only loadOrder, preserves private settings, reports restart until the game manifest matches and rejects stale uploads/configuration');
 const failures=[
  [['Skyrim.esm','World.esm','Patch.esp','Alpha.esp'],'DEPENDENCY_ORDER'],
  [['Skyrim.esm','World.esm','Alpha.esp','Unused.esl'],'MASTER_ORDER'],
  [['Skyrim.esm','Skyrim.esm'],'DUPLICATE_PLUGIN'],
  [['SKYRIM.ESM','Skyrim.esm'],'DUPLICATE_PLUGIN'],
  [['Skyrim.esm','../Alpha.esp'],'INVALID_ORDER'],
  [['Skyrim.esm','CON.esp'],'INVALID_ORDER'],
  [['Skyrim.esm','broken.esp'],'INVALID_PLUGIN'],
  [['Skyrim.esm','DoesNotExist.esp'],'INVALID_PLUGIN'],
 ];
 for(const [loadOrder,code]of failures){response=await post({revision:snapshot.revision,loadOrder});assert.equal(response.status,400,code);assert.equal((await response.json()).code,code);assert.equal(fs.readFileSync(cfg,'utf8'),unchanged);}
 assert.equal((await get('anonymous')).status,403);assert.equal((await get('viewer')).status,200);assert.equal((await post({revision:snapshot.revision,loadOrder:order},'viewer')).status,403);assert.equal((await post({revision:snapshot.revision,loadOrder:order},'admin','https://other.invalid')).status,403);
 checks.push('Missing masters, dependency/master order, invalid/missing files, duplicates and path traversal rejected; viewer read-only and cross-origin saves denied');
 reads=0;injectLatest=true;response=await post({revision:snapshot.revision,loadOrder:order});assert.equal(response.status,200,await response.clone().text());assert.equal(read().other.updated,true);assert.equal(read().masterKey,settings.masterKey);injectLatest=false;
 const legacy=read();legacy.loadOrder.push('Missing.esp');fs.writeFileSync(cfg,JSON.stringify(legacy));snapshot=await (await get()).json();assert.equal(snapshot.entries.find(entry=>entry.name==='Missing.esp').issue,'missing');
 checks.push('Concurrent unrelated configuration edits survive saves and missing configured plugins remain visible for repair');
 response=await post({revision:snapshot.revision,loadOrder:[]});assert.equal(response.status,200,await response.clone().text());snapshot=await response.json();assert.deepEqual(read().loadOrder,baseFiles);
 response=await post({revision:snapshot.revision,loadOrder:['FolderMod.esp'],modFolders:['Community'],skseFolders:['Community'],skseGameVersion:'1.6.1170.0'});assert.equal(response.status,200,await response.clone().text());snapshot=await response.json();assert.deepEqual(read().loadOrder,[...baseFiles,'mods/Community/FolderMod.esp']);assert.deepEqual(read().modFolders,['Community']);assert.deepEqual(read().launcherResources.skseFolders,['Community']);assert.equal(read().launcherResources.runtimeSource,settings.launcherResources.runtimeSource);
 response=await post({revision:snapshot.revision,loadOrder:[],modFolders:['Missing']});assert.equal(response.status,400);
 response=await post({revision:snapshot.revision,loadOrder:[],skseGameVersion:'latest'});assert.equal((await response.json()).code,'INVALID_GAME_VERSION');
 response=await post({revision:snapshot.revision,loadOrder:[],modFolders:[],skseFolders:[],skseGameVersion:''});assert.equal(response.status,200,await response.clone().text());snapshot=await response.json();
 checks.push('Plugins from data/mods are saved as subpaths, and folder order, DLL opt-in and game version are validated and persisted');
 const baseOnly=fs.readFileSync(cfg,'utf8');
 fs.renameSync(path.join(data,'Update.esm'),path.join(data,'Update.esm.fixture-backup'));snapshot=await (await get()).json();response=await post({revision:snapshot.revision,loadOrder:[]});assert.equal(response.status,400);assert.equal((await response.json()).plugin,'Update.esm');assert.equal(fs.readFileSync(cfg,'utf8'),baseOnly);fs.renameSync(path.join(data,'Update.esm.fixture-backup'),path.join(data,'Update.esm'));
 fs.writeFileSync(path.join(data,'Update.esm'),'corrupt fixture');snapshot=await (await get()).json();response=await post({revision:snapshot.revision,loadOrder:[]});assert.equal(response.status,400);assert.equal(fs.readFileSync(cfg,'utf8'),baseOnly);
 checks.push('An empty custom selection keeps all five base files; missing or corrupt required files reject saves without changing settings');
 console.log(JSON.stringify({ok:true,checks,writes,realGameStarted:false,serverBuild:false}));
}finally{if(server)await new Promise(resolve=>server.close(resolve));assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert(path.basename(root).startsWith('skymp-mod-order-'));fs.rmSync(root,{recursive:true,force:true});}
