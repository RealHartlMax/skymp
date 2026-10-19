const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const webpack = require('webpack');
const BundleBudgetPlugin = require('./bundle-budget-plugin');

const compile = (context, outputPath, mode, maxGzipBytes) => new Promise((resolve, reject) => {
  const compiler = webpack({
    context,
    entry: './entry.js',
    mode,
    output: { path: outputPath, filename: 'build.js' },
    plugins: [new BundleBudgetPlugin({ maxGzipBytes })],
  });
  compiler.run((error, stats) => {
    compiler.close((closeError) => {
      if (error || closeError) reject(error || closeError);
      else resolve(stats);
    });
  });
});

test('production budget includes lazy chunks; development remains usable above budget', async (t) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-bundle-budget-'));
  t.after(() => {
    // Remove only the fresh directory created for this test.
    const resolved = fs.realpathSync(fixture);
    const tempRoot = fs.realpathSync(os.tmpdir()) + path.sep;
    assert.ok(resolved.startsWith(tempRoot));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  fs.writeFileSync(path.join(fixture, 'entry.js'),
    'import("./lazy.js").then(value => { window.budgetTest = value.default; });');
  fs.writeFileSync(path.join(fixture, 'lazy.js'), 'export default "Lazy module loaded";');

  const outputPath = path.join(fixture, 'dist');
  const success = await compile(fixture, outputPath, 'production', 500 * 1024);
  assert.equal(success.hasErrors(), false);
  const report = JSON.parse(fs.readFileSync(path.join(outputPath, 'bundle-size.json'), 'utf8'));
  assert.equal(report.mode, 'production');
  assert.equal(report.withinBudget, true);
  assert.ok(report.assets.some(asset => asset.initial));
  assert.ok(report.assets.some(asset => !asset.initial));
  assert.equal(report.totals.gzipBytes,
    report.assets.reduce((total, asset) => total + asset.gzipBytes, 0));

  const initialGzipBytes = report.assets.filter(asset => asset.initial)
    .reduce((total, asset) => total + asset.gzipBytes, 0);
  const exceeded = await compile(fixture, outputPath, 'production', initialGzipBytes);
  assert.equal(exceeded.hasErrors(), true, 'Lazy chunks must count towards the budget');
  assert.match(exceeded.toString({ all: false, errors: true }), /JavaScript gzip budget exceeded/);

  const development = await compile(fixture, outputPath, 'development', 1);
  assert.equal(development.hasErrors(), false, 'Development builds must remain available for debugging');
  const devReport = JSON.parse(fs.readFileSync(path.join(outputPath, 'bundle-size.json'), 'utf8'));
  assert.equal(devReport.mode, 'development');
  assert.equal(devReport.withinBudget, false);
});
