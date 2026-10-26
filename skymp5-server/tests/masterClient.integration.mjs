import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import http from 'node:http';
const source=resolve(fileURLToPath(new URL('../ts/systems/masterClient.ts',import.meta.url)));
const temporary=await mkdtemp(join(tmpdir(),'skymp-heartbeat-test-'));
const originalSignals=new Map(['SIGINT','SIGTERM'].map(signal=>[signal,new Set(process.listeners(signal))]));
const requests=[],logs=[],checks=[];
const key='skymp_live_LOCAL_TEST_KEY_12345678',uid='srv_local_test';
let status=200,body={ok:true};
const server=http.createServer(async(req,res)=>{
 let bytes='';for await(const chunk of req)bytes+=chunk;
 requests.push({path:req.url,body:JSON.parse(bytes)});
 res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));
});
try {
 const outfile=process.env.SKYMP_MASTER_UNIT_BUNDLE||join(temporary,'master.cjs');
 if(!process.env.SKYMP_MASTER_UNIT_BUNDLE) await build({entryPoints:[source],outfile,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
 const {MasterClient}=createRequire(import.meta.url)(outfile);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const master='http://127.0.0.1:'+server.address().port;
 const client=new MasterClient(line=>logs.push(String(line)),7777,'87.106.58.116',master+'/',32,'Test',key,15000,false,'Roleplay','DE',uid);
 await client.initAsync();
 assert.equal(requests.length,1);
 assert.equal(requests[0].path,'/api/servers/'+key);
 assert.equal(requests[0].body.server_uid,uid);
 assert.equal(requests[0].body.ip,'87.106.58.116');
 assert.equal(requests[0].body.online,0);
 assert(!JSON.stringify(requests[0].body).includes(key));
 assert(logs.some(line=>line.includes('accepted (HTTP 200')));
 assert(!logs.some(line=>line.includes(key)));
 checks.push('Canonical heartbeat route, trailing-slash handling, public identity and address, immediate success log without private key');
 status=404;body={error:'Server is not registered yet. Create it in dashboard or enable heartbeat auto-registration.'};
 await client.sendHeartbeat(2,'periodic');
 assert(logs.some(line=>line.includes('api/servers/index.php')));
 checks.push('Legacy registry 404 is explained as a webroute/dashboard configuration problem');
 status=401;body={error:'Invalid key '+key};
 await client.sendHeartbeat(2,'periodic');
 assert(!logs.some(line=>line.includes(key)));
 assert(logs.some(line=>line.includes('[redacted]')));
 checks.push('Reflected private keys are redacted from error responses and actionable 401 guidance is logged');
 status=200;body={ok:true};
 const acceptedBefore=logs.filter(line=>line.includes('accepted (HTTP 200')).length;
 await client.sendHeartbeat(4,'periodic');
 assert.equal(logs.filter(line=>line.includes('accepted (HTTP 200')).length,acceptedBefore+1);
 await client.sendHeartbeat(4,'periodic');
 assert.equal(logs.filter(line=>line.includes('accepted (HTTP 200')).length,acceptedBefore+1);
 const realNow=Date.now,start=realNow();
 try{
  Date.now=()=>start+60000;await client.sendHeartbeat(4,'periodic');
  assert.equal(logs.filter(line=>line.includes('accepted (HTTP 200')).length,acceptedBefore+1);
  Date.now=()=>start+300000;await client.sendHeartbeat(4,'periodic');
  assert.equal(logs.filter(line=>line.includes('accepted (HTTP 200')).length,acceptedBefore+2);
 }finally{Date.now=realNow;}
 checks.push('Recovery is logged immediately; regular success messages are bounded to once per five minutes without changing heartbeat delivery');
 const count=requests.length;
 for(const [url,privateKey,offline] of [[master,key,true],['http://user:secret@127.0.0.1',key,false],[master,'',false],[master,null,false],[master,undefined,false]]){
  await new MasterClient(line=>logs.push(String(line)),7777,'87.106.58.116',url,32,'Test',privateKey,15000,offline).initAsync();
 }
 assert.equal(requests.length,count);
 checks.push('Offline mode, credential-bearing master URL and empty/null/missing keys never send requests or prevent system initialization');
 console.log(JSON.stringify({ok:true,checks,requests:requests.length,realGameStarted:false,realServerJoined:false},null,2));
}finally{
 for(const [signal,old] of originalSignals)for(const listener of process.listeners(signal))if(!old.has(listener))process.removeListener(signal,listener);
 await new Promise(resolve=>server.close(resolve));
 await rm(temporary,{recursive:true,force:true,maxRetries:4,retryDelay:100});
}
