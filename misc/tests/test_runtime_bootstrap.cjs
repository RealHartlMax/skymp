const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-runtime-test-'));
const windows = process.platform === 'win32';
const templates = path.resolve(__dirname, '../deploy/test-server');
const checks = [];
const quote = value => "'" + value.replace(/'/g, "''") + "'";
function fixture(name, installed) {
  const dir = path.join(root, name); fs.mkdirSync(dir);
  for (const file of windows ? ['bootstrap-runtime.ps1'] : ['bootstrap-runtime.sh', 'start-test-server.sh']) fs.copyFileSync(path.join(templates, file), path.join(dir, file));
  const runtime = path.join(dir, '.runtime'); fs.mkdirSync(runtime);
  const version = 'node-v22.0.0-' + (windows ? 'win-x64' : 'linux-x64');
  if (installed) {
    const binary = path.join(runtime, version, windows ? 'node.exe' : 'bin/node');
    fs.mkdirSync(path.dirname(binary), { recursive: true }); fs.copyFileSync(process.execPath, binary); fs.chmodSync(binary, 0o755);
    fs.writeFileSync(path.join(runtime, 'node-path.txt'), version); fs.writeFileSync(path.join(runtime, 'checked-at.txt'), '0');
  }
  fs.writeFileSync(path.join(dir, 'server-settings.json'), '{"preserve":"operator-data"}');
  return dir;
}
function run(dir, mode, offline = false) {
  const env = { ...process.env, SKYMP_MANAGED_NODE: '1', SKYMP_RUNTIME_OFFLINE: offline ? '1' : '0', SKYMP_RUNTIME_CHECK_ONLY: '1' };
  let command, args;
  if (windows) {
    const hook = mode === 'unavailable' ? "throw 'mock network unavailable'" : `if ($Uri.EndsWith('SHASUMS256.txt')) { [IO.File]::WriteAllText($OutFile, '${'0'.repeat(64)}  node-v22.999.0-win-x64.zip') } else { [IO.File]::WriteAllText($OutFile, 'corrupt-download') }`;
    const script = path.join(dir, 'test-run.ps1');
    fs.writeFileSync(script, `$ErrorActionPreference='Stop'\nfunction Invoke-WebRequest { param([switch]$UseBasicParsing,[string]$Uri,[string]$OutFile,[int]$TimeoutSec) ${hook} }\n& ${quote(path.join(dir, 'bootstrap-runtime.ps1'))} -CheckOnly\nexit $LASTEXITCODE\n`);
    command = 'powershell.exe'; args = ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script];
  } else {
    const tools = path.join(dir, 'test-tools'); fs.mkdirSync(tools, { recursive: true });
    const action = mode === 'unavailable' ? 'exit 22' : `case "$uri" in */SHASUMS256.txt) printf '%s  %s\\n' '${'0'.repeat(64)}' 'node-v22.999.0-linux-x64.tar.gz' > "$output" ;; *) printf 'corrupt-download' > "$output" ;; esac`;
    fs.writeFileSync(path.join(tools, 'curl'), `#!/bin/sh\nwhile [ "$#" -gt 0 ]; do case "$1" in -o) output=$2; shift 2; continue ;; https:*) uri=$1 ;; esac; shift; done\n${action}\n`, { mode: 0o755 });
    env.PATH = tools + path.delimiter + env.PATH; command = 'sh'; args = ['./start-test-server.sh'];
  }
  return spawnSync(command, args, { cwd: dir, env, encoding: 'utf8', timeout: 30000 });
}
try {
  const existing = fixture('existing', true);
  const pointer = fs.readFileSync(path.join(existing, '.runtime/node-path.txt'), 'utf8');
  let result = run(existing, 'unavailable', true);
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  checks.push('An existing private runtime starts offline without requesting a download');
  result = run(existing, 'unavailable');
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.equal(fs.readFileSync(path.join(existing, '.runtime/node-path.txt'), 'utf8'), pointer);
  checks.push('Failed update retains the installed runtime and pointer');
  const empty = fixture('corrupt', false);
  result = run(empty, 'corrupt');
  assert.notEqual(result.status, 0);
  assert(!fs.existsSync(path.join(empty, '.runtime/node-path.txt')));
  assert.equal(fs.readdirSync(path.join(empty, '.runtime')).filter(name => name.startsWith('node-v')).length, 0);
  assert.equal(fs.readFileSync(path.join(empty, 'server-settings.json'), 'utf8'), '{"preserve":"operator-data"}');
  checks.push('SHA256 mismatch blocks activation and preserves operator configuration');
  const absent = fixture('offline-missing', false);
  result = run(absent, 'unavailable', true);
  assert.notEqual(result.status, 0);
  assert(!fs.existsSync(path.join(absent, '.runtime/node-path.txt')));
  checks.push('Offline first run fails clearly when no usable runtime exists');
  console.log(JSON.stringify({ ok: true, platform: process.platform, checks, realNetwork: false }));
} finally {
  assert.equal(path.dirname(root), path.resolve(os.tmpdir())); assert(path.basename(root).startsWith('skymp-runtime-test-'));
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 6, retryDelay: 300 });
}
