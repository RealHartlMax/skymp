import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const script=fileURLToPath(new URL('../../cmake/scripts/generate_server_settings.cmake',import.meta.url));
const root=await mkdtemp(join(tmpdir(),'skymp-settings-test-'));
const checks=[];
try {
 const generate=async(name,input,args=[])=>{
  const file=join(root,name+'.json');
  if(input)await writeFile(file,JSON.stringify(input));
  execFileSync('cmake',['-DSERVER_SETTINGS_JSON_PATH='+file,'-DOFFLINE_MODE=false',...args,'-P',script],{stdio:'pipe'});
  return JSON.parse(await readFile(file,'utf8'));
 };
 const defaults=await generate('fresh');
 assert.equal(defaults.master,'https://api.skymp-worlds.net');
 assert.equal(defaults.launcherResources.runtimeSource,'https://update.skymp-worlds.net/client-runtime/catalog.json');
 assert.equal(defaults.launcherResources.enabled,true);
 checks.push('Fresh server templates use the dashboard master and external runtime catalog');
 const custom={masterKey:'LOCAL_PRIVATE_TEST_KEY',serverUid:'srv_existing',loadOrder:['World.esm'],dataDir:'world-data',launcherResources:{enabled:false,directory:'custom',runtimeSource:'https://custom.example.invalid/catalog.json'}};
 const merged=await generate('custom',custom);
 for(const key of ['masterKey','serverUid','loadOrder','dataDir','launcherResources'])assert.deepEqual(merged[key],custom[key]);
 checks.push('Existing identity, private key, world paths, load order and explicit resource settings are preserved');
 const empty=await generate('empty',{launcherResources:{runtimeSource:''}});
 assert.equal(empty.launcherResources.runtimeSource,'');
 const alternate=await generate('alternate',null,['-DMASTER_URL=https://master.example.invalid','-DRUNTIME_CATALOG_URL=']);
 assert.equal(alternate.master,'https://master.example.invalid');
 assert.equal(alternate.launcherResources.runtimeSource,'');
 checks.push('Empty and alternate operator-configured runtime/master sources remain configurable');
 const badFile=join(root,'invalid.json'),bad=JSON.stringify({launcherResources:['invalid']});
 await writeFile(badFile,bad);
 assert.throws(()=>execFileSync('cmake',['-DSERVER_SETTINGS_JSON_PATH='+badFile,'-P',script],{stdio:'pipe'}));
 assert.equal(await readFile(badFile,'utf8'),bad);
 checks.push('Invalid resource configuration fails without overwriting the original file');
 console.log(JSON.stringify({ok:true,checks},null,2));
}finally{await rm(root,{recursive:true,force:true,maxRetries:4,retryDelay:100});}