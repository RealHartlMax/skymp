// Bound diagnostics and execution even when a native regression blocks JS timers.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
try {
  const output = execFileSync(process.execPath, [path.join(__dirname, 'native-addon.cjs'), process.argv[2]], {
    encoding: 'utf8', timeout: 900000, maxBuffer: 1024 * 1024,
  });
  process.stdout.write(output);
} catch (error) {
  process.stderr.write(String(error.stderr ?? '').slice(-16000));
  process.stderr.write(String(error.stdout ?? '').slice(-8000));
  console.error('Native integration fixture failed:', error.code ?? error.status ?? error.message);
  process.exitCode = 1;
}
