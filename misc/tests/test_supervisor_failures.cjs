// A startup timeout or an unexpected clean exit must never be reported as a
// planned stop. Uses disposable Node children, no native module or Discord.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { createSupervisor } = require('../deploy/test-server/server-supervisor.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [];
async function scenario(mode) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-supervisor-failure-'));
  let manager;
  try {
    const reservation = net.createServer(); await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
    const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
    fs.writeFileSync(path.join(root, 'server-settings.json'), JSON.stringify({ uiPort: port, uiListenHost: '127.0.0.1' }));
    fs.writeFileSync(path.join(root, 'dashboard.cjs'), `
const fs=require('node:fs');
process.on('message',message=>{
 if(message.type==='skymp:game-state') fs.appendFileSync('states.ndjson',JSON.stringify(message.value)+'\\n');
 if(message.type==='skymp:shutdown') process.exit(0);
});
process.on('disconnect',()=>process.exit(0));
process.send({type:'skymp:ready',port:12345});
`);
    fs.writeFileSync(path.join(root, 'game.cjs'), `
process.on('message',message=>{if(message.type==='skymp:shutdown')process.exit(0)});
process.on('disconnect',()=>process.exit(0));
${mode === 'clean-exit' ? "process.send({type:'skymp:ready',port:12346}); setTimeout(()=>process.exit(0),200);" : mode === 'early-exit' ? 'setTimeout(()=>process.exit(1),100);' : ''}
`);
    manager = createSupervisor({ root, entry: 'game.cjs', dashboardEntry: 'dashboard.cjs', args: [], startupTimeout: 700, stopTimeout: 1000 });
    manager.start();
    let states = [];
    for (let i = 0; i < 200; i++) {
      const file = path.join(root, 'states.ndjson');
      if (fs.existsSync(file)) states = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
      if (states.some(state => state.state === 'crashed')) break;
      await delay(20);
    }
    const crashed = states.find(state => state.state === 'crashed'); assert(crashed, mode);
    assert.equal(crashed.pid, null);
    assert.equal(crashed.reason, mode === 'timeout' ? 'startup-timeout' : mode === 'early-exit' ? 'startup-failed' : null);
    assert.equal(crashed.lastExit.code, mode === 'early-exit' ? 1 : 0);
    await delay(100);
    assert(!states.some(state => state.state === 'stopped'));
    checks.push(mode + ': classified as a failure with exit details; dashboard retained and no automatic restart loop');
  } finally {
    if (manager) {
      const closed = new Promise(resolve => manager.server.once('close', resolve));
      manager.close(); await Promise.race([closed, delay(5000)]);
      assert.equal(manager.server.listening, false);
    }
    assert.equal(path.dirname(root), path.resolve(os.tmpdir())); assert(path.basename(root).startsWith('skymp-supervisor-failure-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
}
(async () => {
  for (const mode of ['timeout', 'early-exit', 'clean-exit']) await scenario(mode);
  console.log(JSON.stringify({ ok: true, platform: process.platform, checks, realGameStarted: false, realDiscordConnected: false }));
})().catch(error => { console.error(error); process.exitCode = 1; });
