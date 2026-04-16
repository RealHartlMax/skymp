const Koa = require("koa");
const serve = require("koa-static");
const proxy = require("koa-proxy");
const Router = require("koa-router");
const auth = require("koa-basic-auth");
import * as koaBody from "koa-body";
import * as http from "http";
import { Settings } from "./settings";
import Axios from "axios";
import { AddressInfo } from "net";
import { register, getAggregatedMetrics, rpcCallsCounter, rpcDurationHistogram } from "./systems/metricsSystem";

let gScampServer: any = null;

let metricsAuth: { user: string; password: string } | null = null;
let adminAuth: { user: string; password: string } | null = null;
const processStartedAt = Date.now();

const metricsAuthParse = (settings: Settings): void => {
  const authConfig = settings.allSettings?.metricsAuth as { user?: string; password?: string } | undefined;
  if (!authConfig) {
    console.log('Metrics auth is not configured, so it will be inaccessible. Set metricsAuth setting to activate');
    return;
  }
  if (!authConfig.user || !authConfig.password) {
    console.error('metricsAuth setting must contain user and password fields');
    return;
  }
  metricsAuth = { user: authConfig.user, password: authConfig.password };
}

const adminAuthParse = (settings: Settings): void => {
  const authConfig = settings.allSettings?.adminUiAuth as { user?: string; password?: string } | undefined;
  if (authConfig?.user && authConfig?.password) {
    adminAuth = { user: authConfig.user, password: authConfig.password };
    return;
  }

  if (metricsAuth?.user && metricsAuth?.password) {
    adminAuth = metricsAuth;
    console.log('adminUiAuth is not configured, falling back to metricsAuth credentials');
    return;
  }

  console.log('Admin dashboard auth is not configured and metricsAuth fallback is unavailable');
};

const getOnlinePlayerIds = (): number[] => {
  const onlinePlayers = gScampServer?.get?.(0, "onlinePlayers");
  if (!Array.isArray(onlinePlayers)) {
    return [];
  }
  return onlinePlayers.filter((v: unknown) => typeof v === 'number') as number[];
};

const safeCall = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

const renderAdminDashboard = () => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>SkyMP Admin</title>
  <style>
    :root {
      --bg: #0b1217;
      --bg-soft: #111c24;
      --card: #182833;
      --text: #e6f0f2;
      --muted: #9db4bb;
      --accent: #19b47a;
      --warn: #d85d5d;
      --line: #2c4552;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Tahoma, sans-serif;
      color: var(--text);
      background: radial-gradient(circle at 10% -20%, #1f3440 0%, transparent 45%), var(--bg);
    }
    .wrap { max-width: 1040px; margin: 0 auto; padding: 20px; }
    .top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
    .title { font-size: 24px; font-weight: 700; letter-spacing: .3px; }
    .muted { color: var(--muted); }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }
    .card {
      background: linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,0)), var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px;
    }
    .k { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
    .v { font-size: 22px; margin-top: 4px; }
    .section { margin-top: 14px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid var(--line); font-size: 14px; }
    th { color: var(--muted); font-weight: 600; }
    button {
      background: transparent;
      color: var(--warn);
      border: 1px solid var(--warn);
      border-radius: 8px;
      padding: 6px 10px;
      cursor: pointer;
    }
    button:hover { background: rgba(216,93,93,.12); }
    .ok { color: var(--accent); }
    @media (max-width: 900px) { .grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
    @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } .top { flex-direction: column; align-items: flex-start; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div>
        <div class="title" id="title">SkyMP Admin Dashboard</div>
        <div class="muted" id="subtitle"></div>
      </div>
      <div class="muted" id="updatedAt"></div>
    </div>

    <div class="grid">
      <div class="card"><div class="k" id="kOnline"></div><div class="v" id="online">0</div></div>
      <div class="card"><div class="k" id="kMax"></div><div class="v" id="maxPlayers">0</div></div>
      <div class="card"><div class="k" id="kPort"></div><div class="v" id="port">-</div></div>
      <div class="card"><div class="k" id="kUptime"></div><div class="v" id="uptime">0s</div></div>
    </div>

    <div class="section card">
      <div class="k" id="playersTitle"></div>
      <table>
        <thead>
          <tr>
            <th id="hUser"></th>
            <th id="hActor"></th>
            <th id="hName"></th>
            <th id="hIp"></th>
            <th id="hPos"></th>
            <th id="hActions"></th>
          </tr>
        </thead>
        <tbody id="playersBody"></tbody>
      </table>
      <div class="muted" id="status"></div>
    </div>
  </div>

  <script>
    const I18N = {
      en: {
        title: 'SkyMP Admin Dashboard', subtitle: 'Live server status and player controls',
        online: 'Online', maxPlayers: 'Max Players', port: 'Port', uptime: 'Uptime', players: 'Connected Players',
        user: 'User', actor: 'Actor', name: 'Name', ip: 'IP', pos: 'Position', actions: 'Actions',
        kick: 'Kick', noPlayers: 'No players online', updated: 'Updated', kicked: 'User kicked',
      },
      de: {
        title: 'SkyMP Admin Dashboard', subtitle: 'Live-Serverstatus und Spielerverwaltung',
        online: 'Online', maxPlayers: 'Max Spieler', port: 'Port', uptime: 'Laufzeit', players: 'Verbundene Spieler',
        user: 'Benutzer', actor: 'Actor', name: 'Name', ip: 'IP', pos: 'Position', actions: 'Aktionen',
        kick: 'Kicken', noPlayers: 'Keine Spieler online', updated: 'Aktualisiert', kicked: 'Benutzer gekickt',
      },
      ru: {
        title: 'SkyMP Admin Dashboard', subtitle: 'Live-статус сервера и управление игроками',
        online: 'Онлайн', maxPlayers: 'Макс. игроки', port: 'Порт', uptime: 'Аптайм', players: 'Игроки в сети',
        user: 'Пользователь', actor: 'Актер', name: 'Имя', ip: 'IP', pos: 'Позиция', actions: 'Действия',
        kick: 'Кик', noPlayers: 'Игроков онлайн нет', updated: 'Обновлено', kicked: 'Игрок кикнут',
      }
    };

    const lang = ((navigator.language || 'en').slice(0,2).toLowerCase());
    const t = I18N[lang] || I18N.en;

    const setText = (id, value) => { document.getElementById(id).textContent = value; };
    setText('title', t.title); setText('subtitle', t.subtitle);
    setText('kOnline', t.online); setText('kMax', t.maxPlayers); setText('kPort', t.port); setText('kUptime', t.uptime);
    setText('playersTitle', t.players);
    setText('hUser', t.user); setText('hActor', t.actor); setText('hName', t.name); setText('hIp', t.ip); setText('hPos', t.pos); setText('hActions', t.actions);

    const fmtUptime = (s) => {
      const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = Math.floor(s % 60);
      if (h > 0) return h + 'h ' + m + 'm';
      if (m > 0) return m + 'm ' + sec + 's';
      return sec + 's';
    };

    const kick = async (userId) => {
      const res = await fetch('/api/admin/players/' + userId + '/kick', { method: 'POST' });
      if (res.ok) {
        setText('status', t.kicked + ': ' + userId);
        await refresh();
      }
    };

    const refresh = async () => {
      const [statusRes, playersRes] = await Promise.all([
        fetch('/api/admin/status'),
        fetch('/api/admin/players'),
      ]);
      if (!statusRes.ok || !playersRes.ok) {
        setText('status', 'API error');
        return;
      }
      const status = await statusRes.json();
      const players = await playersRes.json();

      setText('online', String(status.online));
      setText('maxPlayers', String(status.maxPlayers));
      setText('port', String(status.port));
      setText('uptime', fmtUptime(status.uptimeSec));
      setText('updatedAt', t.updated + ': ' + new Date().toLocaleTimeString());

      const tbody = document.getElementById('playersBody');
      tbody.innerHTML = '';

      if (!players.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 6;
        td.className = 'muted';
        td.textContent = t.noPlayers;
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }

      for (const p of players) {
        const tr = document.createElement('tr');
        const pos = Array.isArray(p.pos) ? p.pos.map((x) => Number(x).toFixed(0)).join(', ') : '-';
        tr.innerHTML = '<td>' + p.userId + '</td>' +
                       '<td>' + (p.actorId || '-') + '</td>' +
                       '<td>' + (p.actorName || '-') + '</td>' +
                       '<td>' + (p.ip || '-') + '</td>' +
                       '<td>' + pos + '</td>';
        const actionTd = document.createElement('td');
        const btn = document.createElement('button');
        btn.textContent = t.kick;
        btn.onclick = () => kick(p.userId);
        actionTd.appendChild(btn);
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
      }
    };

    refresh();
    setInterval(refresh, 3000);
  </script>
</body>
</html>`;

const createApp = (settings: Settings, getOriginPort: () => number) => {
  const app = new Koa();
  app.use(koaBody.default({ multipart: true }));

  app.use(async (ctx: any, next: any) => {
    try {
      await next();
    } catch (err: any) {
      if (401 === err.status) {
        ctx.status = 401;
        ctx.set("WWW-Authenticate", "Basic realm=\"metrics\"");
      } else {
        throw err;
      }
    }
  });

  const router = new Router();
  router.get(new RegExp("/scripts/.*"), (ctx: any) => ctx.throw(403));
  router.get(new RegExp("\.es[mpl]"), (ctx: any) => ctx.throw(403));
  router.get(new RegExp("\.bsa"), (ctx: any) => ctx.throw(403));

  router.post("/rpc/:rpcClassName", (ctx: any) => {
    const { rpcClassName } = ctx.params;
    const { payload } = ctx.request.body;

    rpcCallsCounter.inc({ rpcClassName });
    const endTimer = rpcDurationHistogram.startTimer({ rpcClassName });

    try {
      if (gScampServer.onHttpRpcRunAttempt) {
        ctx.body = gScampServer.onHttpRpcRunAttempt(rpcClassName, payload);
      }
    } finally {
      endTimer();
    }
  });

  if (adminAuth) {
    router.use('/admin', auth({ name: adminAuth.user, pass: adminAuth.password }));
    router.use('/api/admin', auth({ name: adminAuth.user, pass: adminAuth.password }));

    router.get('/admin', (ctx: any) => {
      ctx.redirect('/admin/');
    });

    router.get('/admin/', (ctx: any) => {
      ctx.type = 'text/html; charset=utf-8';
      ctx.body = renderAdminDashboard();
    });

    router.get('/api/admin/status', (ctx: any) => {
      ctx.body = {
        name: settings.name,
        master: settings.master,
        online: getOnlinePlayerIds().length,
        maxPlayers: settings.maxPlayers,
        port: settings.port,
        uptimeSec: Math.floor((Date.now() - processStartedAt) / 1000),
      };
    });

    router.get('/api/admin/players', (ctx: any) => {
      const players = getOnlinePlayerIds().map((userId) => {
        const actorId = safeCall(() => gScampServer.getUserActor(userId), 0);
        return {
          userId,
          actorId,
          actorName: actorId ? safeCall(() => gScampServer.getActorName(actorId), '') : '',
          ip: safeCall(() => gScampServer.getUserIp(userId), ''),
          pos: actorId ? safeCall(() => gScampServer.getActorPos(actorId), []) : [],
          cellOrWorld: actorId ? safeCall(() => gScampServer.getActorCellOrWorld(actorId), 0) : 0,
        };
      });
      ctx.body = players;
    });

    router.post('/api/admin/players/:userId/kick', (ctx: any) => {
      const userId = Number(ctx.params.userId);
      if (!Number.isFinite(userId)) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'invalid userId' };
        return;
      }
      safeCall(() => gScampServer.kick(userId), undefined);
      ctx.body = { ok: true, userId };
    });
  }

  router.use('/metrics', (ctx: any, next: any) => {
    console.log(`Metrics requested by ${ctx.request.ip}`);
    return next();
  });

  if (metricsAuth) {
    if (metricsAuth.password !== "I know what I'm doing, disable metrics auth") {
      router.use("/metrics", auth({ name: metricsAuth.user, pass: metricsAuth.password }));
    }
    router.get("/metrics", async (ctx: any) => {
      ctx.set("Content-Type", register.contentType);
      ctx.body = await getAggregatedMetrics(gScampServer);
    });
  } else {
    router.get("/metrics", async (ctx: any) => {
      ctx.throw(401);
      console.error("Metrics endpoint is protected by authentication, but no credentials are configured");
    });
  }

  app.use(router.routes()).use(router.allowedMethods());
  app.use(serve("data"));
  return app;
};

export const setServer = (scampServer: any) => {
  gScampServer = scampServer;
};

export const main = (settings: Settings): void => {
  metricsAuthParse(settings);
  adminAuthParse(settings);
  const devServerPort = 1234;

  const uiListenHost = settings.allSettings.uiListenHost as (string | undefined);
  const uiPort = settings.port === 7777 ? 3000 : settings.port + 1;

  Axios({
    method: "get",
    url: `http://localhost:${devServerPort}`,
  })
    .then(() => {
      console.log(`UI dev server has been detected on port ${devServerPort}`);

      const state = { port: 0 };

      const appStatic = createApp(settings, () => state.port);
      const srv = http.createServer(appStatic.callback());
      srv.listen(0, () => {
        const { port } = srv.address() as AddressInfo;
        state.port = port;
        const appProxy = new Koa();
        appProxy.use(
          proxy({
            host: `http://localhost:${devServerPort}`,
            map: (path: string) => {
              const resultPath = path.match(/^\/ui\/.*/)
                ? `http://localhost:${devServerPort}` + path.substr(3)
                : `http://localhost:${port}` + path;
              console.log(`proxy ${path} => ${resultPath}`);
              return resultPath;
            },
          })
        );
        console.log(`Server resources folder is listening on ${uiPort}`);
        http.createServer(appProxy.callback()).listen(uiPort, uiListenHost);
      });
    })
    .catch(() => {
      const app = createApp(settings, () => uiPort);
      console.log(`Server resources folder is listening on ${uiPort}`);
      const server = http.createServer(app.callback());
      server.listen(uiPort, uiListenHost);
    });
};
