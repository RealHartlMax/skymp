// Disposable game process for dashboard lifecycle tests. Never loads Skyrim data.
const http = require('node:http');
const dgram = require('node:dgram');
const sessions = new Map();
const udp = dgram.createSocket('udp4');
const server = http.createServer(async (req, res) => {
  const id = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith('skymp_admin_session='))?.split('=')[1];
  if (!sessions.has(id)) { res.writeHead(401, { 'content-type': 'application/json' }); res.end('{}'); return; }
  res.setHeader('content-type', 'application/json');
  if (req.url === '/api/admin/players') { res.end(JSON.stringify([{ userId: 1, actorId: 1, actorName: 'Fixture', online: true, ip: '127.0.0.1', pos: [0, 0, 0] }])); return; }
  if (req.url === '/api/admin/console') {
    let body = ''; for await (const chunk of req) body += chunk;
    const command = JSON.parse(body).command;
    if (command === 'crash') { res.end(JSON.stringify({ ok: true })); setTimeout(() => process.exit(23), 50); return; }
    if (command === 'discord-warning') process.send({ type: 'skymp:discord-notification', notification: { kind: 'warning', content: 'Game warning forwarded to dashboard Discord bot' } });
    console.log('dashboard-log-' + process.pid);
    res.end(JSON.stringify({ ok: true, resultText: 'game:' + process.pid })); return;
  }
  if (req.url.startsWith('/api/admin/history')) { res.end(JSON.stringify({ entries: [], totalWarns: 0, newWarns7d: 0, totalBans: 0, newBans7d: 0, admins: [] })); return; }
  res.end(JSON.stringify([]));
});
process.on('message', message => {
  if (message.type === 'skymp:session') sessions.set(message.id, message);
  if (message.type === 'skymp:logout') sessions.delete(message.id);
  if (message.type === 'skymp:shutdown') { udp.close(); server.close(() => process.exit(0)); }
});
process.on('disconnect', () => process.exit(0));
udp.bind(0, '127.0.0.1', () => server.listen(0, '127.0.0.1', () => {
  console.log('game-started-' + process.pid);
  process.send({ type: 'skymp:ready', port: server.address().port });
  setInterval(() => process.send({ type: 'skymp:update', updateType: 'status', data: { online: 1, maxPlayers: 16, port: udp.address().port } }), 200);
  // Known test measurements exercise the real supervisor/dashboard IPC path.
  setInterval(() => process.send({ type: 'skymp:performance', sample: {
    at: Date.now(), pid: process.pid, players: 1,
    runtime: { cpuPercent: 12.5, rssBytes: 128 * 1048576, heapUsedBytes: 24 * 1048576, eventLoopMs: 21 },
    ticks: { count: 100, totalMs: 75, maxMs: 2, buckets: [75, 25, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  } }), 1000);
}));
