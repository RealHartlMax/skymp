const { gzipSync } = require('node:zlib');

const PLUGIN_NAME = 'BundleBudgetPlugin';
const REPORT_FILENAME = 'bundle-size.json';

// Guard the measured production baseline (about 794 KiB gzip) with modest
// headroom. The roadmap's 500 KiB target still requires further optimization.
// Include future lazy chunks; images, audio and maps are outside this JS budget.
class BundleBudgetPlugin {
  constructor({ maxGzipBytes = 850 * 1024 } = {}) {
    this.maxGzipBytes = maxGzipBytes;
  }

  apply(compiler) {
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
        },
        () => {
          const initialFiles = new Set(
            [...compilation.entrypoints.values()].flatMap((entry) => entry.getFiles()),
          );
          const assets = compilation.getAssets()
            .filter(({ name }) => /\.m?js$/i.test(name))
            .map(({ name, source }) => {
              const contents = source.buffer();
              return {
                name,
                initial: initialFiles.has(name),
                bytes: contents.length,
                gzipBytes: gzipSync(contents).length,
              };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
          const totals = assets.reduce((sum, asset) => ({
            bytes: sum.bytes + asset.bytes,
            gzipBytes: sum.gzipBytes + asset.gzipBytes,
          }), { bytes: 0, gzipBytes: 0 });
          const report = {
            mode: compiler.options.mode,
            budgetGzipBytes: this.maxGzipBytes,
            withinBudget: totals.gzipBytes <= this.maxGzipBytes,
            totals,
            assets,
          };

          compilation.emitAsset(
            REPORT_FILENAME,
            new compiler.webpack.sources.RawSource(JSON.stringify(report, null, 2) + '\n'),
          );

          if (report.mode === 'production' && !report.withinBudget) {
            compilation.errors.push(new compiler.webpack.WebpackError(
              `JavaScript gzip budget exceeded: ${totals.gzipBytes} > ${this.maxGzipBytes} bytes. ` +
              'Reduce the bundle before publishing. Current assets: ' +
              assets.map(asset => `${asset.name}: ${asset.gzipBytes} gzip bytes`).join(', '),
            ));
          }
        },
      );
    });
  }
}

module.exports = BundleBudgetPlugin;
