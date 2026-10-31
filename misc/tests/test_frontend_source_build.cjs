// Run the real CMake frontend target without a PAT or external frontend checkout.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-local-front-'));
try {
  const source = path.join(temp, 'source'), build = path.join(temp, 'build'); fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'CMakeLists.txt'), `cmake_minimum_required(VERSION 3.21)\nproject(local_frontend NONE)\nset(BUILD_FRONT ON)\nadd_subdirectory("${path.join(root, 'skymp5-front').replace(/\\/g, '/')}" frontend)\n`);
  const environment = { ...process.env }; delete environment.SKYMP5_FRONT_REPO_PAT; delete environment.SKYMP5_FRONT_PAT;
  for (const args of [['-S', source, '-B', build, '-G', 'Ninja'], ['--build', build, '--target', 'skymp5-front']]) {
    console.log('CMake frontend check:', args[0]);
    const result = spawnSync('cmake', args, { env: environment, stdio: 'inherit', timeout: 240000 });
    assert.equal(result.status, 0, result.error?.message || 'CMake failed at ' + args[0]);
  }
  const ui = path.join(build, 'dist/client/Data/Platform/UI');
  assert(fs.readFileSync(path.join(ui, 'build.js'), 'utf8').includes('skympChat:packet'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(ui, 'assets-manifest.json'))).mode, 'production');
  assert(fs.existsSync(path.join(ui, 'index.html')));
  console.log('PASS: CMake builds this checkout into Data/Platform/UI with no frontend PAT/download');
} finally {
  assert.equal(path.dirname(temp), fs.realpathSync(os.tmpdir())); assert(path.basename(temp).startsWith('skymp-local-front-'));
  fs.rmSync(temp, { recursive: true, force: true });
}
