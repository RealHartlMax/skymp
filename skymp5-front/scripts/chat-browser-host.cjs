// Local host for testing the actual built frontend with the real adapter and
// plugin. Only SkyrimPlatform/native networking are replaced with fixtures.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { clientHarness } = require('../../skymp5-client/tests/helpers/chatHarness.cjs');
const { loadPluginFixture } = require('../../skymp5-client/tests/helpers/chatPluginFixture.cjs');
async function createHost({ pluginRoot, config, localeOverrides }) {
  const f = loadPluginFixture(pluginRoot, config, localeOverrides);
  const chat = f.chat;
  let protectedActions = 0;
  chat.api.registerCommand({ owner: 'browser-test', name: 'secret', description: 'Protected command', permission: 'admin', execute() { protectedActions++; } });
  const requests = [];
  const clients = [0, 1].map(id => clientHarness(packet => { requests.push({ id, packet }); f.mp.emit('customPacket', id, JSON.stringify(packet)); }));
  f.mp.sendCustomPacket = (id, content) => clients[id]?.receive(JSON.parse(content));
  const front = path.resolve(__dirname, '../dist');
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
  const server = http.createServer((req, res) => {
    const filename = path.resolve(front, '.' + (new URL(req.url, 'http://localhost').pathname === '/' ? '/index.html' : decodeURIComponent(new URL(req.url, 'http://localhost').pathname)));
    if (!filename.startsWith(front + path.sep) || !fs.existsSync(filename) || fs.statSync(filename).isDirectory()) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', mime[path.extname(filename)] || 'application/octet-stream');
    fs.createReadStream(filename).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}/`, clients, requests, players: f.players, api: chat.api,
    get protectedActions() { return protectedActions; }, stopPlugin: () => chat.stop(),
    close: async () => { chat.stop(); await new Promise(resolve => server.close(resolve)); } };
}
module.exports = { createHost };
