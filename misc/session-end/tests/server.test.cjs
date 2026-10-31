const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {load}=require('../../console-security/tests/load-source.cjs');
const {installPlayerSessionEnd,endPlayerSession}=load('skymp5-server/ts/playerSessionEnd.ts');
const wait=()=>new Promise(resolve=>setTimeout(resolve,190));
function fixture(){
 const server=new EventEmitter(),users=new Map(),sent=[],closed=[];
 Object.assign(server,{isConnected:id=>users.has(id),getUserGuid:id=>users.get(id),kick:id=>closed.push(id),
  sendCustomPacket:(id,raw)=>sent.push({id,...JSON.parse(raw)}),get:()=>[101],getUserByActor:()=>1,getUserActor:id=>id===1?101:0});
 const service=installPlayerSessionEnd(server);
 const connect=(id,guid)=>{users.set(id,guid);server.emit('connect',id);};
 return{server,service,users,sent,closed,connect};
}
test('kick sends final reliable notice and then closes only its captured connection',async()=>{
 const f=fixture();f.connect(1,'one');f.server.kick(1);assert.equal(f.sent[0].kind,'kick');assert.deepEqual(f.closed,[]);
 await wait();assert.deepEqual(f.closed,[1]);
});
test('ban preserves bounded operator reason and expiry and outranks a later generic kick',async()=>{
 const f=fixture();f.connect(1,'one');const until=Date.now()+60000;
 endPlayerSession(f.server,1,'ban','x'.repeat(700)+'\n',until);f.server.kick(1);
 assert.equal(f.sent.length,1);assert.equal(f.sent[0].message.length,512);assert.equal(f.sent[0].until,until);
 await wait();assert.deepEqual(f.closed,[1]);
});
test('disconnect and connection-slot reuse revoke a pending kick',async()=>{
 const f=fixture();f.connect(1,'one');f.server.kick(1);f.users.delete(1);f.server.emit('disconnect',1);f.connect(1,'two');
 await wait();assert.deepEqual(f.closed,[]);
});
test('GUID change alone prevents a delayed close of a different connection',async()=>{
 const f=fixture();f.connect(1,'one');f.server.kick(1);f.users.set(1,'two');await wait();assert.deepEqual(f.closed,[]);
});
test('planned restart notifies authenticated and pre-spawn connected sessions',async()=>{
 const f=fixture();f.connect(1,'one');f.connect(2,'two');f.service.shutdown('restart');
 assert.deepEqual(f.sent.map(v=>[v.id,v.kind]),[[1,'restart'],[2,'restart']]);await wait();assert.deepEqual(f.closed,[1,2]);
});
test('heartbeat only acknowledges connected clients and bounded valid nonces',()=>{
 const f=fixture();f.connect(1,'one');
 const ping=nonce=>JSON.stringify({customPacketType:'skymp:sessionPing',version:1,nonce});
 f.server.emit('customPacket',9,ping('valid'));f.server.emit('customPacket',1,ping('../bad'));
 f.server.emit('customPacket',1,JSON.stringify({customPacketType:'skympChat:send',version:1,nonce:'valid'}));assert.equal(f.sent.length,0);
 f.server.emit('customPacket',1,ping('valid_1'));assert.equal(f.sent[0].customPacketType,'skymp:sessionPong');assert.equal(f.sent[0].nonce,'valid_1');
 f.server.emit('customPacket',1,ping('valid_2'));assert.equal(f.sent.length,1);
});
