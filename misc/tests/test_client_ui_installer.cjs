const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
test('UI installer validates sources before writing, backs up replaced files, preserves private/native files and is idempotent',{skip:process.platform!=='win32'},()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'skymp-ui-install-test-'));
 const pwsh=path.join(process.env.ProgramFiles,'PowerShell/7/pwsh.exe');
 const script=path.resolve(__dirname,'../deploy/install_client_ui.ps1');
 const game=path.join(temp,'game'),runtime=path.join(temp,'runtime'),backup=path.join(temp,'backup');
 const write=(root,name,bytes)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);};
 const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
 const run=(...extra)=>spawnSync(pwsh,['-NoProfile','-NonInteractive','-File',script,'-GameDirectory',game,'-RuntimeDirectory',runtime,'-BackupDirectory',backup,...extra],{encoding:'utf8',timeout:30000});
 try {
  fs.mkdirSync(game);fs.mkdirSync(runtime);
  const system=path.join(process.env.WINDIR,'System32/notepad.exe');fs.copyFileSync(system,path.join(game,'SkyrimSE.exe'));
  const version=spawnSync(pwsh,['-NoProfile','-NonInteractive','-Command',"(Get-Item -LiteralPath '"+path.join(game,'SkyrimSE.exe').replaceAll("'","''")+"').VersionInfo.FileVersion"],{encoding:'utf8'}).stdout.match(/\d+\.\d+\.\d+\.\d+/)[0];
  const content={'Data/Platform/Plugins/skymp5-client.js':'skympChat:send','Data/Platform/UI/build.js':'skympChat:packet','Data/Platform/UI/index.html':'new index'};
  const manifest={version:1,gameVersion:version,files:Object.entries(content).map(([name,bytes])=>{write(runtime,name,bytes);write(game,name,'old '+name);return{path:name,size:Buffer.byteLength(bytes),sha256:hash(bytes)}})};
  const save=()=>write(runtime,'runtime-manifest.json',JSON.stringify(manifest));save();
  const settings='Data/Platform/Plugins/skymp5-client-settings.txt',native='Data/SKSE/Plugins/operator.dll';
  write(game,settings,'private fixture');write(game,native,'native fixture');
  const before=()=>{for(const name of Object.keys(content))assert.equal(fs.readFileSync(path.join(game,name),'utf8'),'old '+name);assert(!fs.existsSync(backup));};
  write(runtime,'Data/Platform/UI/build.js','corrupt');assert.notEqual(run('-Apply').status,0);before();write(runtime,'Data/Platform/UI/build.js',content['Data/Platform/UI/build.js']);
  manifest.files.push({path:'Data/Platform/UI/../../../outside',size:0,sha256:hash('')});save();assert.notEqual(run('-Apply').status,0);before();manifest.files.pop();save();
  const preview=run();assert.equal(preview.status,0,preview.stderr);assert.equal(JSON.parse(preview.stdout).applied,false);before();
  const applied=run('-Apply');assert.equal(applied.status,0,applied.stderr);assert.equal(JSON.parse(applied.stdout).applied,true);
  for(const [name,bytes] of Object.entries(content)){assert.equal(fs.readFileSync(path.join(game,name),'utf8'),bytes);assert.equal(fs.readFileSync(path.join(backup,name),'utf8'),'old '+name);}
  assert.equal(fs.readFileSync(path.join(game,settings),'utf8'),'private fixture');assert.equal(fs.readFileSync(path.join(game,native),'utf8'),'native fixture');
  const again=run('-Apply');assert.equal(again.status,0,again.stderr);assert.equal(JSON.parse(again.stdout).alreadyCurrent,true);
 }finally{assert.equal(path.dirname(temp),path.resolve(os.tmpdir()));assert(path.basename(temp).startsWith('skymp-ui-install-test-'));fs.rmSync(temp,{recursive:true,force:true});}
});
