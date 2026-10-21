const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'build-manifest.json'), 'utf8'));
const actual = `${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`;
if (actual !== manifest.platform) throw new Error(`Paket ${manifest.platform}, dieses System ${actual}. Bitte das passende Paket verwenden.`);
if (Number(process.versions.node.split('.')[0]) < manifest.nodeMinimum) throw new Error(`Node.js ${manifest.nodeMinimum} oder neuer wird benoetigt.`);
const settings = JSON.parse(fs.readFileSync(path.join(root, 'server-settings.json'), 'utf8'));
if (manifest.installationMode === 'first-run' && !require('./setup-server.cjs').isConfigured(root, settings)) {
  throw new Error('Ersteinrichtung fehlt. Den Server mit start-test-server.sh bzw. start-test-server.cmd starten und die Browser-Einrichtung abschliessen.');
}
const missing = settings.loadOrder.filter(name => !fs.existsSync(path.resolve(root, settings.dataDir, name)));
if (missing.length) throw new Error(`Spieldaten fehlen in ${settings.dataDir}: ${missing.join(', ')}. Siehe data/SPIELDATEN.txt.`);
for (const name of settings.loadOrder) {
  const target = path.resolve(root, settings.dataDir, name);
  const descriptor = fs.openSync(target, 'r');
  const header = Buffer.alloc(4);
  fs.readSync(descriptor, header, 0, 4, 0); fs.closeSync(descriptor);
  if (header.toString() !== 'TES4') throw new Error(`Ungueltige Masterdatei: ${name}`);
}
for (const name of ['scam_native.node', 'dist_back/skymp5-server.js', 'ui/build.js', 'data/scripts']) {
  if (!fs.existsSync(path.join(root, name))) throw new Error(`Paketdatei fehlt: ${name}`);
}
const native = require(path.join(root, 'scam_native.node'));
if (typeof native.ScampServer !== 'function') throw new Error('Native Server-Erweiterung ist unvollstaendig.');
console.log(`SkyMP ${manifest.buildId}: ${manifest.platform}, Node ${process.versions.node}, ${settings.loadOrder.length} Masterdateien bereit.`);
