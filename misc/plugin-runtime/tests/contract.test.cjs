const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { validatePackage, signedPayload, packageRoot } = require('../contract.cjs');
const { createRuntimeManifest, verifyRuntimePackage } = require('../package.cjs');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const valid = () => ({formatVersion:1,pluginId:'example',version:'1.2.3',requires:{clientApi:1,uiApi:1},entrypoints:{client:'client.js',ui:'ui.js',styles:['ui.css']},files:['client.js','ui.js','ui.css'].map(name=>({path:name,size:1,sha256:hash('a')}))});
test('producer contract rejects unsafe paths, collisions, native binaries and undeclared entrypoints',()=>{
  assert.equal(validatePackage(valid()).pluginId,'example');
  for(const bad of ['../client.js','C:/client.js','folder\\client.js','CON.js','assets/AUX.svg','.secret.json','native.dll','private.pem','a//client.js']) {
    const value=valid();value.files[0].path=bad; assert.throws(()=>validatePackage(value),undefined,bad);
  }
  for(const mutate of [v=>v.files.push({...v.files[0],path:'CLIENT.js'}),v=>v.entrypoints.client='absent.js',v=>v.requires.clientApi=2,v=>v.config={secret:'never'},v=>v.files[0].size=16*1024*1024+1]) {const value=valid();mutate(value);assert.throws(()=>validatePackage(value));}
  for(const id of [undefined,null,{},123]){const value=valid();value.pluginId=id;assert.throws(()=>validatePackage(value));}
  assert.equal(packageRoot('example','a'.repeat(64)),`Data/Platform/PluginRuntime/packages/example/${'a'.repeat(64)}/`);
});
test('canonical signing is deterministic and detects mutations',()=>{
  const a=valid(),b={files:a.files,entrypoints:a.entrypoints,requires:a.requires,version:a.version,pluginId:a.pluginId,formatVersion:1};
  assert.equal(signedPayload(a),signedPayload(b));
  const pair=crypto.generateKeyPairSync('ed25519'), signature=crypto.sign(null,Buffer.from(signedPayload(a)),pair.privateKey);
  assert(crypto.verify(null,Buffer.from(signedPayload(b)),pair.publicKey,signature));b.version='1.2.4';
  assert(!crypto.verify(null,Buffer.from(signedPayload(b)),pair.publicKey,signature));
});
test('SDK signs explicit public files and rejects changed files or keys inside Runtime',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'skymp-runtime-sdk-')),root=path.join(directory,'Runtime');fs.mkdirSync(root);
  const pair=crypto.generateKeyPairSync('ed25519'),key=path.join(directory,'publisher.pem');fs.writeFileSync(key,pair.privateKey.export({type:'pkcs8',format:'pem'}));
  fs.writeFileSync(path.join(root,'client.js'),'exports.apiVersion=1;exports.activate=()=>{};');fs.writeFileSync(path.join(directory,'config.json'),'PRIVATE');
  try {
    const m=createRuntimeManifest({root,pluginId:'example',version:'1.0.0',entrypoints:{client:'client.js'},files:['client.js'],privateKeyFile:key,keyId:'publisher'});
    assert.equal(m.files.length,1);assert.equal(verifyRuntimePackage(root,{name:'example',version:'1.0.0'}).signature.keyId,'publisher');
    assert(crypto.verify(null,Buffer.from(signedPayload(m)),pair.publicKey,Buffer.from(m.signature.value,'hex')));
    fs.appendFileSync(path.join(root,'client.js'),'tamper');assert.throws(()=>verifyRuntimePackage(root),/integrity/);
    fs.copyFileSync(key,path.join(root,'private.pem'));assert.throws(()=>createRuntimeManifest({root,pluginId:'example',version:'1.0.0',entrypoints:{client:'client.js'},files:['client.js'],privateKeyFile:path.join(root,'private.pem'),keyId:'publisher'}),/outside/);
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});
