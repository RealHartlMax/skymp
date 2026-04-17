const Koa = require("koa");
const serve = require("koa-static");
const proxy = require("koa-proxy");
const Router = require("koa-router");
const auth = require("koa-basic-auth");
import * as koaBody from "koa-body";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { Settings } from "./settings";
import Axios from "axios";
import { AddressInfo } from "net";
import { register, getAggregatedMetrics, rpcCallsCounter, rpcDurationHistogram } from "./systems/metricsSystem";

let gScampServer: any = null;

let metricsAuth: { user: string; password: string } | null = null;
let adminAuth: { user: string; password: string } | null = null;
const processStartedAt = Date.now();
// ---------------------------------------------------------------------------
// Admin event log (in-memory, capped at MAX_ADMIN_LOG entries)
// ---------------------------------------------------------------------------
interface AdminLogEntry { ts: number; type: 'kick' | 'ban' | 'mute' | 'console'; message: string; }
const adminLog: AdminLogEntry[] = [];
const MAX_ADMIN_LOG = 500;

interface FrontendMetricEntry {
  name: string;
  value: number;
  source: string;
  ts: number;
  receivedAt: number;
  url?: string;
}

const frontendMetrics: FrontendMetricEntry[] = [];
const MAX_FRONTEND_METRICS = 1000;

interface AdminCapabilities {
  canKick: boolean;
  canBan: boolean;
  canUnban: boolean;
  canConsole: boolean;
  canViewLogs: boolean;
  canMessage: boolean;
  canMute: boolean;
  canUnmute: boolean;
}

type AdminRole = 'admin' | 'moderator' | 'viewer';

const ADMIN_ROLE_DEFAULT_CAPABILITIES: Record<AdminRole, AdminCapabilities> = {
  admin: {
    canKick: true,
    canBan: true,
    canUnban: true,
    canConsole: true,
    canViewLogs: true,
    canMessage: true,
    canMute: true,
    canUnmute: true,
  },
  moderator: {
    canKick: true,
    canBan: true,
    canUnban: true,
    canConsole: false,
    canViewLogs: true,
    canMessage: true,
    canMute: true,
    canUnmute: true,
  },
  viewer: {
    canKick: false,
    canBan: false,
    canUnban: false,
    canConsole: false,
    canViewLogs: true,
    canMessage: false,
    canMute: false,
    canUnmute: false,
  },
};

const addAdminLog = (type: AdminLogEntry['type'], message: string): void => {
  adminLog.push({ ts: Date.now(), type, message });
  if (adminLog.length > MAX_ADMIN_LOG) adminLog.shift();
};

const addFrontendMetrics = (entries: FrontendMetricEntry[]): void => {
  frontendMetrics.push(...entries);
  if (frontendMetrics.length > MAX_FRONTEND_METRICS) {
    frontendMetrics.splice(0, frontendMetrics.length - MAX_FRONTEND_METRICS);
  }
};

const summarizeFrontendMetrics = (entries: FrontendMetricEntry[]) => {
  const sourceCounts = new Map<string, number>();
  const nameCounts = new Map<string, number>();

  let errorCount = 0;
  let totalValue = 0;
  let lastReceivedAt: number | null = null;

  entries.forEach((entry) => {
    sourceCounts.set(entry.source, (sourceCounts.get(entry.source) || 0) + 1);
    nameCounts.set(entry.name, (nameCounts.get(entry.name) || 0) + 1);
    totalValue += entry.value;

    if (
      entry.source.includes('error')
      || entry.name.includes('error')
      || entry.name === 'unhandledrejection'
    ) {
      errorCount += 1;
    }

    if (lastReceivedAt === null || entry.receivedAt > lastReceivedAt) {
      lastReceivedAt = entry.receivedAt;
    }
  });

  const toTopList = (input: Map<string, number>) => Array.from(input.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    totalCount: entries.length,
    errorCount,
    lastReceivedAt,
    averageValue: entries.length > 0 ? Number((totalValue / entries.length).toFixed(2)) : 0,
    sources: toTopList(sourceCounts),
    names: toTopList(nameCounts),
  };
};

const bannedUserIds = new Set<number>();
const mutedUsers = new Map<number, number>(); // userId -> expiresAt (ms timestamp)

// ---------------------------------------------------------------------------
// Persistence helpers – ban/mute lists survive server restarts
// ---------------------------------------------------------------------------
const saveBans = (dataDir: string): void => {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'admin-bans.json'),
      JSON.stringify(Array.from(bannedUserIds)),
      'utf8',
    );
  } catch (e) {
    console.error('Failed to persist ban list:', e);
  }
};

const saveMutes = (dataDir: string): void => {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    cleanupExpiredMutes();
    fs.writeFileSync(
      path.join(dataDir, 'admin-mutes.json'),
      JSON.stringify(Array.from(mutedUsers.entries())),
      'utf8',
    );
  } catch (e) {
    console.error('Failed to persist mute list:', e);
  }
};

const loadModerationState = (dataDir: string): void => {
  try {
    const bansPath = path.join(dataDir, 'admin-bans.json');
    if (fs.existsSync(bansPath)) {
      const ids = JSON.parse(fs.readFileSync(bansPath, 'utf8')) as number[];
      ids.forEach((id) => bannedUserIds.add(id));
      console.log(`Loaded ${bannedUserIds.size} banned userId(s) from ${bansPath}`);
    }
  } catch (e) {
    console.error('Failed to load ban list:', e);
  }
  try {
    const mutesPath = path.join(dataDir, 'admin-mutes.json');
    if (fs.existsSync(mutesPath)) {
      const entries = JSON.parse(fs.readFileSync(mutesPath, 'utf8')) as [number, number][];
      const now = Date.now();
      entries.forEach(([userId, expiresAt]) => {
        if (expiresAt > now) mutedUsers.set(userId, expiresAt);
      });
      console.log(`Loaded ${mutedUsers.size} active muted userId(s) from ${mutesPath}`);
    }
  } catch (e) {
    console.error('Failed to load mute list:', e);
  }
};

const cleanupExpiredMutes = (): void => {
  const now = Date.now();
  mutedUsers.forEach((expiresAt, userId) => {
    if (expiresAt <= now) mutedUsers.delete(userId);
  });
};

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

const mergeAdminCapabilities = (
  base: AdminCapabilities,
  overrides: Partial<AdminCapabilities> | undefined,
): AdminCapabilities => {
  if (!overrides) return base;
  return {
    canKick: typeof overrides.canKick === 'boolean' ? overrides.canKick : base.canKick,
    canBan: typeof overrides.canBan === 'boolean' ? overrides.canBan : base.canBan,
    canUnban: typeof overrides.canUnban === 'boolean' ? overrides.canUnban : base.canUnban,
    canConsole: typeof overrides.canConsole === 'boolean' ? overrides.canConsole : base.canConsole,
    canViewLogs: typeof overrides.canViewLogs === 'boolean' ? overrides.canViewLogs : base.canViewLogs,
    canMessage: typeof overrides.canMessage === 'boolean' ? overrides.canMessage : base.canMessage,
    canMute: typeof overrides.canMute === 'boolean' ? overrides.canMute : base.canMute,
    canUnmute: typeof overrides.canUnmute === 'boolean' ? overrides.canUnmute : base.canUnmute,
  };
};

const normalizeAdminRole = (value: unknown): AdminRole => {
  if (value === 'admin' || value === 'moderator' || value === 'viewer') return value;
  return 'viewer';
};

const getBasicAuthUser = (ctx: any): string => {
  const stateUser = ctx?.state?.user;
  if (typeof stateUser === 'string' && stateUser.length > 0) return stateUser;

  const authHeader = String(ctx?.headers?.authorization ?? '');
  const m = authHeader.match(/^Basic\s+(.+)$/i);
  if (!m) return '';

  try {
    const decoded = Buffer.from(m[1], 'base64').toString('utf8');
    const [user] = decoded.split(':');
    return user || '';
  } catch {
    return '';
  }
};

const getAdminRoleForUser = (settings: Settings, user: string): AdminRole => {
  const map = settings.allSettings?.adminUiRoles as Record<string, unknown> | undefined;
  if (user && map && Object.prototype.hasOwnProperty.call(map, user)) {
    return normalizeAdminRole(map[user]);
  }

  if (adminAuth?.user && user === adminAuth.user) return 'admin';
  return 'viewer';
};

const getAdminCapabilitiesForRole = (settings: Settings, role: AdminRole): AdminCapabilities => {
  const roleOverridesMap = settings.allSettings?.adminUiRoleCapabilities as Record<string, Partial<AdminCapabilities>> | undefined;
  const roleOverrides = roleOverridesMap?.[role];
  const legacyGlobalOverrides = settings.allSettings?.adminUiCapabilities as Partial<AdminCapabilities> | undefined;

  const fromRoleDefaults = ADMIN_ROLE_DEFAULT_CAPABILITIES[role];
  const afterRoleOverrides = mergeAdminCapabilities(fromRoleDefaults, roleOverrides);
  return mergeAdminCapabilities(afterRoleOverrides, legacyGlobalOverrides);
};

const getAdminContext = (settings: Settings, ctx: any): {
  user: string;
  role: AdminRole;
  capabilities: AdminCapabilities;
} => {
  const user = getBasicAuthUser(ctx);
  const role = getAdminRoleForUser(settings, user);
  const capabilities = getAdminCapabilitiesForRole(settings, role);
  return { user, role, capabilities };
};

const ensureAdminCapability = (
  settings: Settings,
  ctx: any,
  capability: keyof AdminCapabilities,
): boolean => {
  const { capabilities } = getAdminContext(settings, ctx);
  if (capabilities[capability]) return true;

  ctx.status = 403;
  ctx.body = { ok: false, error: 'forbidden' };
  return false;
};

const renderAdminDashboard = () => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>SkyMP Admin</title>
  <style>
    :root { --bg: #0b1217; --bg-soft: #111c24; --card: #182833; --text: #e6f0f2; --muted: #9db4bb; --accent: #19b47a; --warn: #d85d5d; --line: #2c4552; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", Tahoma, sans-serif; color: var(--text); background: radial-gradient(circle at 10% -20%, #1f3440 0%, transparent 45%), var(--bg); }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 20px; }
    .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
    .title { font-size: 24px; font-weight: 700; letter-spacing: .3px; }
    .muted { color: var(--muted); font-size: 13px; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; margin-bottom: 16px; }
    .card { background: linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,0)), var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; }
    .k { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
    .v { font-size: 24px; font-weight: 700; margin-top: 4px; }
    .v--accent { color: var(--accent); }
    .tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); margin-bottom: 14px; }
    .tab { background: none; border: none; color: var(--muted); font-size: 14px; padding: 8px 16px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; font-family: inherit; }
    .tab:hover { color: var(--text); }
    .tab.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
    .panel { display: none; } .panel.active { display: block; }
    .search-row { display: flex; gap: 8px; margin-bottom: 12px; }
    .search-input { background: var(--card); border: 1px solid var(--line); color: var(--text); border-radius: 8px; padding: 7px 12px; font-size: 13px; flex: 1; font-family: inherit; }
    .search-input:focus { outline: none; border-color: var(--accent); }
    .tbl-wrap { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: var(--card); }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .07em; padding: 10px 14px; font-weight: 500; background: rgba(255,255,255,.03); border-bottom: 1px solid var(--line); }
    td { padding: 10px 14px; border-bottom: 1px solid rgba(44,69,82,.5); }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: rgba(255,255,255,.03); }
    td.pos { font-family: monospace; font-size: 12px; color: var(--muted); }
    .btn { background: transparent; border-radius: 6px; padding: 4px 12px; font-size: 12px; cursor: pointer; font-family: inherit; transition: background .15s, border-color .15s; }
    .btn:active { transform: scale(.97); }
    .btn-kick { color: var(--warn); border: 1px solid rgba(216,93,93,.4); }
    .btn-kick:hover { background: rgba(216,93,93,.2); border-color: var(--warn); }
    .btn-ban { color: #e07b40; border: 1px solid rgba(224,123,64,.4); margin-left: 4px; }
    .btn-ban:hover { background: rgba(224,123,64,.2); border-color: #e07b40; }
    .btn-send { color: var(--accent); border: 1px solid rgba(25,180,122,.4); padding: 7px 18px; font-size: 13px; }
    .btn-send:hover { background: rgba(25,180,122,.15); border-color: var(--accent); }
    .console-out { background: #060e13; border: 1px solid var(--line); border-radius: 8px; padding: 12px; font-family: monospace; font-size: 13px; height: 280px; overflow-y: auto; color: var(--text); margin-bottom: 10px; white-space: pre-wrap; word-break: break-word; }
    .console-row { display: flex; gap: 8px; }
    .console-input { background: var(--card); border: 1px solid var(--line); color: var(--text); border-radius: 8px; padding: 8px 12px; font-size: 13px; flex: 1; font-family: monospace; }
    .console-input:focus { outline: none; border-color: var(--accent); }
    .log-filters { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
    .log-filter { background: var(--card); border: 1px solid var(--line); border-radius: 6px; color: var(--muted); font-size: 12px; padding: 4px 10px; cursor: pointer; font-family: inherit; }
    .log-filter.active { border-color: var(--accent); color: var(--accent); }
    .log-list { display: flex; flex-direction: column; gap: 6px; }
    .log-entry { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; display: flex; gap: 12px; align-items: flex-start; font-size: 13px; }
    .log-ts { color: var(--muted); font-size: 11px; white-space: nowrap; flex-shrink: 0; }
    .log-type { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; padding: 2px 6px; border-radius: 4px; flex-shrink: 0; }
    .log-type--kick { background: rgba(216,93,93,.15); color: var(--warn); }
    .log-type--ban  { background: rgba(224,123,64,.15); color: #e07b40; }
    .log-type--console { background: rgba(25,180,122,.12); color: var(--accent); }
    .log-msg { color: var(--text); word-break: break-word; }
    .no-data { color: var(--muted); font-size: 14px; padding: 16px 0; }
    .status-bar { font-size: 13px; color: var(--muted); margin-top: 10px; min-height: 18px; }
    @media (max-width: 900px) { .grid { grid-template-columns: repeat(2,1fr); } }
    @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div><div class="title" id="title">SkyMP Admin Dashboard</div><div class="muted" id="subtitle"></div></div>
      <div class="muted" id="updatedAt"></div>
    </div>
    <div class="grid">
      <div class="card"><div class="k" id="kOnline"></div><div class="v v--accent" id="online">-</div></div>
      <div class="card"><div class="k" id="kMax"></div><div class="v" id="maxPlayers">-</div></div>
      <div class="card"><div class="k" id="kPort"></div><div class="v" id="port">-</div></div>
      <div class="card"><div class="k" id="kUptime"></div><div class="v" id="uptime">-</div></div>
    </div>
    <div class="tabs">
      <button class="tab active" data-tab="players" id="tabPlayers"></button>
      <button class="tab" data-tab="console" id="tabConsole"></button>
      <button class="tab" data-tab="logs" id="tabLogs"></button>
    </div>
    <div class="panel active" id="panel-players">
      <div class="search-row"><input class="search-input" id="playerSearch" type="text" /></div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th id="hUser"></th><th id="hActor"></th><th id="hName"></th><th id="hIp"></th><th id="hPos"></th><th id="hActions"></th></tr></thead>
          <tbody id="playersBody"></tbody>
        </table>
      </div>
      <div class="status-bar" id="playerStatus"></div>
    </div>
    <div class="panel" id="panel-console">
      <div class="console-out" id="consoleOut"></div>
      <div class="console-row">
        <input class="console-input" id="consoleInput" type="text" />
        <button class="btn btn-send" id="consoleSendBtn"></button>
      </div>
    </div>
    <div class="panel" id="panel-logs">
      <div class="log-filters">
        <button class="log-filter active" data-type="">All</button>
        <button class="log-filter" data-type="kick" id="fKick"></button>
        <button class="log-filter" data-type="ban" id="fBan"></button>
        <button class="log-filter" data-type="console" id="fConsole"></button>
      </div>
      <div class="log-list" id="logList"></div>
    </div>
  </div>
  <script>
    const I18N = {
      en: { title:'SkyMP Admin Dashboard',subtitle:'Live server status and player controls',online:'Online',maxPlayers:'Max Players',port:'Port',uptime:'Uptime',tabPlayers:'Players',tabConsole:'Console',tabLogs:'Activity Log',user:'User ID',actor:'Actor ID',name:'Name',ip:'IP',pos:'Position',actions:'Actions',kick:'Kick',ban:'Ban',noPlayers:'No players online',updated:'Updated',kicked:'Kicked',banned:'Banned',searchPlaceholder:'Filter players...',consoleSend:'Send',consoleHint:'> Enter JavaScript command',sent:'Command sent',apiError:'API error',noLogs:'No log entries',fKick:'Kick',fBan:'Ban',fConsole:'Console' },
      de: { title:'SkyMP Admin Dashboard',subtitle:'Live-Serverstatus und Spielerverwaltung',online:'Online',maxPlayers:'Max. Spieler',port:'Port',uptime:'Laufzeit',tabPlayers:'Spieler',tabConsole:'Konsole',tabLogs:'Aktivitatslog',user:'Benutzer-ID',actor:'Actor-ID',name:'Name',ip:'IP',pos:'Position',actions:'Aktionen',kick:'Kicken',ban:'Bannen',noPlayers:'Keine Spieler online',updated:'Aktualisiert',kicked:'Gekickt',banned:'Gebannt',searchPlaceholder:'Spieler filtern...',consoleSend:'Senden',consoleHint:'> JavaScript-Befehl eingeben',sent:'Befehl gesendet',apiError:'API-Fehler',noLogs:'Keine Eintrage',fKick:'Kick',fBan:'Ban',fConsole:'Konsole' },
      ru: { title:'SkyMP Admin Dashboard',subtitle:'Status servera i upravlenie igrokami',online:'Online',maxPlayers:'Max igrokov',port:'Port',uptime:'Aptajm',tabPlayers:'Igroki',tabConsole:'Konsol',tabLogs:'Zhurnal',user:'ID polzovatelya',actor:'ID aktora',name:'Imya',ip:'IP',pos:'Poziciya',actions:'Dejstviya',kick:'Kik',ban:'Ban',noPlayers:'Igrokov net',updated:'Obnovleno',kicked:'Kiknut',banned:'Zabanen',searchPlaceholder:'Poisk...',consoleSend:'Otpravit',consoleHint:'> JavaScript komanda',sent:'Otpravleno',apiError:'Oshibka API',noLogs:'Net zapisej',fKick:'Kik',fBan:'Ban',fConsole:'Konsol' }
    };
    const lang = (navigator.language || 'en').slice(0,2).toLowerCase();
    const t = I18N[lang] || I18N.en;
    const el = (id) => document.getElementById(id);
    const setText = (id, v) => { const e = el(id); if (e) e.textContent = v; };
    setText('title',t.title); setText('subtitle',t.subtitle);
    setText('kOnline',t.online); setText('kMax',t.maxPlayers); setText('kPort',t.port); setText('kUptime',t.uptime);
    setText('tabPlayers',t.tabPlayers); setText('tabConsole',t.tabConsole); setText('tabLogs',t.tabLogs);
    setText('hUser',t.user); setText('hActor',t.actor); setText('hName',t.name); setText('hIp',t.ip); setText('hPos',t.pos); setText('hActions',t.actions);
    el('playerSearch').placeholder = t.searchPlaceholder;
    el('consoleInput').placeholder = t.consoleHint;
    setText('consoleSendBtn',t.consoleSend);
    setText('fKick',t.fKick); setText('fBan',t.fBan); setText('fConsole',t.fConsole);
    let activeTab = 'players';
    document.querySelectorAll('.tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        el('panel-' + activeTab).classList.add('active');
        if (activeTab === 'logs') refreshLogs();
      });
    });
    let logTypeFilter = '';
    document.querySelectorAll('.log-filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        logTypeFilter = btn.dataset.type;
        document.querySelectorAll('.log-filter').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        refreshLogs();
      });
    });
    const fmtUptime = (s) => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=Math.floor(s%60); if(h>0)return h+'h '+m+'m'; if(m>0)return m+'m '+sec+'s'; return sec+'s'; };
    const fmtTime = (ts) => new Date(ts).toLocaleTimeString();
    let allPlayers = [];
    const renderPlayers = () => {
      const q = el('playerSearch').value.toLowerCase();
      const filtered = q ? allPlayers.filter((p) => String(p.userId).includes(q)||(p.actorName||'').toLowerCase().includes(q)||(p.ip||'').includes(q)) : allPlayers;
      const tbody = el('playersBody');
      tbody.innerHTML = '';
      if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="6" class="no-data">'+(allPlayers.length?'No match':t.noPlayers)+'</td></tr>'; return; }
      for (const p of filtered) {
        const pos = Array.isArray(p.pos) ? p.pos.map((x) => Math.round(Number(x))).join(', ') : '-';
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>'+p.userId+'</td><td>'+(p.actorId||'-')+'</td><td>'+(p.actorName||'-')+'</td><td>'+(p.ip||'-')+'</td><td class="pos">'+pos+'</td>';
        const td = document.createElement('td');
        const bk = document.createElement('button'); bk.className='btn btn-kick'; bk.textContent=t.kick; bk.onclick=()=>kickPlayer(p.userId);
        const bb = document.createElement('button'); bb.className='btn btn-ban'; bb.textContent=t.ban; bb.onclick=()=>banPlayer(p.userId);
        td.append(bk,bb); tr.appendChild(td); tbody.appendChild(tr);
      }
    };
    el('playerSearch').addEventListener('input', renderPlayers);
    const kickPlayer = async (userId) => { const r=await fetch('/api/admin/players/'+userId+'/kick',{method:'POST'}); setText('playerStatus',r.ok?t.kicked+' #'+userId:t.apiError); if(r.ok)await refreshPlayers(); };
    const banPlayer = async (userId) => { if(!confirm(t.ban+' userId='+userId+'?'))return; const r=await fetch('/api/admin/players/'+userId+'/ban',{method:'POST'}); setText('playerStatus',r.ok?t.banned+' #'+userId:t.apiError); if(r.ok)await refreshPlayers(); };
    const refreshPlayers = async () => {
      const [sr,pr] = await Promise.all([fetch('/api/admin/status'),fetch('/api/admin/players')]);
      if(!sr.ok||!pr.ok){setText('playerStatus',t.apiError);return;}
      const status=await sr.json(); allPlayers=await pr.json();
      setText('online',String(status.online)); setText('maxPlayers',String(status.maxPlayers)); setText('port',String(status.port)); setText('uptime',fmtUptime(status.uptimeSec));
      setText('updatedAt',t.updated+': '+new Date().toLocaleTimeString());
      renderPlayers();
    };
    const appendConsole = (line, color) => { const out=el('consoleOut'); const d=document.createElement('div'); d.textContent=line; if(color)d.style.color=color; out.appendChild(d); out.scrollTop=out.scrollHeight; };
    const sendConsole = async () => {
      const inp=el('consoleInput'); const cmd=inp.value.trim(); if(!cmd)return;
      appendConsole('> '+cmd,'var(--muted)'); inp.value='';
      const r=await fetch('/api/admin/console',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:cmd})});
      appendConsole(r.ok?t.sent:t.apiError,r.ok?'var(--accent)':'var(--warn)');
    };
    el('consoleSendBtn').addEventListener('click', sendConsole);
    el('consoleInput').addEventListener('keydown', (e) => { if(e.key==='Enter')sendConsole(); });
    const refreshLogs = async () => {
      const url=logTypeFilter?'/api/admin/logs?type='+logTypeFilter:'/api/admin/logs';
      const r=await fetch(url); if(!r.ok)return;
      const entries=await r.json(); const list=el('logList'); list.innerHTML='';
      if(!entries.length){list.innerHTML='<div class="no-data">'+t.noLogs+'</div>';return;}
      for(const e of entries){const d=document.createElement('div');d.className='log-entry';d.innerHTML='<span class="log-ts">'+fmtTime(e.ts)+'</span><span class="log-type log-type--'+e.type+'">'+e.type+'</span><span class="log-msg">'+e.message.replace(/</g,'&lt;')+'</span>';list.appendChild(d);}
    };
    refreshPlayers();
    setInterval(()=>{if(activeTab==='players')refreshPlayers();},5000);
    setInterval(()=>{if(activeTab==='logs')refreshLogs();},5000);
  </script>
</body>
</html>`;

const createApp = (settings: Settings, getOriginPort: () => number) => {
  const dataDir: string = settings.dataDir ?? './data';
  loadModerationState(dataDir);

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

  router.post('/api/frontend/metrics', (ctx: any) => {
    const metrics = Array.isArray(ctx.request.body?.metrics)
      ? ctx.request.body.metrics
      : [];
    const requestUrl = typeof ctx.request.body?.url === 'string'
      ? String(ctx.request.body.url).slice(0, 240)
      : undefined;
    const receivedAt = Date.now();

    const safeMetrics = metrics.slice(0, 100).map((metric: any) => ({
      name: String(metric?.name ?? 'unknown').slice(0, 120),
      value: Number(metric?.value ?? 0),
      source: String(metric?.source ?? 'unknown').slice(0, 80),
      ts: Number(metric?.ts ?? Date.now()),
      receivedAt,
      url: requestUrl,
    }));

    if (safeMetrics.length > 0) {
      addFrontendMetrics(safeMetrics);
      console.log(`[frontend-metrics] count=${safeMetrics.length} first=${safeMetrics[0].name}`);
    }

    ctx.body = { ok: true, accepted: safeMetrics.length };
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

    router.get('/api/admin/capabilities', (ctx: any) => {
      const { user, role, capabilities } = getAdminContext(settings, ctx);
      ctx.body = {
        user,
        role,
        ...capabilities,
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
      if (!ensureAdminCapability(settings, ctx, 'canKick')) return;
      const userId = Number(ctx.params.userId);
      if (!Number.isFinite(userId)) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'invalid userId' };
        return;
      }
      safeCall(() => gScampServer.kick(userId), undefined);
      addAdminLog('kick', `Kicked userId=${userId}`);
      ctx.body = { ok: true, userId };
    });

    router.post('/api/admin/players/:userId/ban', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canBan')) return;
      const userId = Number(ctx.params.userId);
      if (!Number.isFinite(userId)) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'invalid userId' };
        return;
      }
      bannedUserIds.add(userId);
      saveBans(dataDir);
      safeCall(() => gScampServer.kick(userId), undefined);
      addAdminLog('ban', `Banned userId=${userId}`);
      ctx.body = { ok: true, userId, banned: true };
    });

    router.delete('/api/admin/players/:userId/ban', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canUnban')) return;
      const userId = Number(ctx.params.userId);
      if (!Number.isFinite(userId)) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'invalid userId' };
        return;
      }
      const wasBanned = bannedUserIds.delete(userId);
      saveBans(dataDir);
      addAdminLog('ban', `Unbanned userId=${userId}`);
      ctx.body = { ok: true, userId, wasBanned };
    });

    router.post('/api/admin/players/:userId/message', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canMessage')) return;
      const userId = Number(ctx.params.userId);
      const message = String(ctx.request.body?.message ?? '').trim();
      const reason = String(ctx.request.body?.reason ?? '').trim();
      if (!Number.isFinite(userId) || !message) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'invalid payload' };
        return;
      }

      safeCall(() => gScampServer.sendChatMessage?.(userId, message), undefined);
      safeCall(() => gScampServer.sendMessage?.(userId, message), undefined);

      const reasonSuffix = reason ? ` reason=${reason.slice(0, 80)}` : '';
      addAdminLog('console', `Message to userId=${userId}: ${message.slice(0, 120)}${reasonSuffix}`);
      ctx.body = { ok: true, userId };
    });

    router.post('/api/admin/players/:userId/mute', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canMute')) return;
      const userId = Number(ctx.params.userId);
      const durationRaw = Number(ctx.request.body?.durationMinutes);
      const reason = String(ctx.request.body?.reason ?? '').trim();
      const durationMinutes = Number.isFinite(durationRaw)
        ? Math.max(1, Math.min(24 * 60, Math.floor(durationRaw)))
        : 10;

      if (!Number.isFinite(userId)) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'invalid userId' };
        return;
      }

      const expiresAt = Date.now() + durationMinutes * 60 * 1000;
      mutedUsers.set(userId, expiresAt);
      saveMutes(dataDir);
      const reasonSuffix = reason ? ` reason=${reason.slice(0, 80)}` : '';
      addAdminLog('mute', `Muted userId=${userId} for ${durationMinutes}m${reasonSuffix}`);
      ctx.body = { ok: true, userId, muted: true, expiresAt, durationMinutes };
    });

    router.delete('/api/admin/players/:userId/mute', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canUnmute')) return;
      const userId = Number(ctx.params.userId);
      if (!Number.isFinite(userId)) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'invalid userId' };
        return;
      }

      const wasMuted = mutedUsers.delete(userId);
      saveMutes(dataDir);
      addAdminLog('mute', `Unmuted userId=${userId}`);
      ctx.body = { ok: true, userId, wasMuted };
    });

    router.get('/api/admin/bans', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canUnban')) return;
      ctx.body = Array.from(bannedUserIds);
    });

    router.get('/api/admin/mutes', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canUnmute')) return;
      cleanupExpiredMutes();

      const now = Date.now();
      ctx.body = Array.from(mutedUsers.entries()).map(([userId, expiresAt]) => ({
        userId,
        expiresAt,
        remainingSec: Math.max(0, Math.floor((expiresAt - now) / 1000)),
      }));
    });

    router.post('/api/admin/console', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canConsole')) return;
      const command = (ctx.request.body?.command as string | undefined) ?? '';
      if (!command.trim()) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'command is required' };
        return;
      }

      try {
        const rawResult = gScampServer.executeJavaScriptOnChakra(command);
        const resultText = rawResult === undefined ? '' : String(rawResult);
        addAdminLog('console', `Executed: ${command.slice(0, 200)}`);
        ctx.body = {
          ok: true,
          command,
          resultText: resultText.slice(0, 1000),
        };
      } catch (error) {
        const errorText = error instanceof Error ? error.message : String(error);
        addAdminLog('console', `Console error: ${errorText.slice(0, 200)}`);
        ctx.status = 500;
        ctx.body = {
          ok: false,
          command,
          error: errorText,
        };
      }
    });

    router.get('/api/admin/logs', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canViewLogs')) return;
      const typeFilter = ctx.query?.type as string | undefined;
      const limitRaw = Number(ctx.query?.limit);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), MAX_ADMIN_LOG)
        : 100;

      const beforeTsRaw = Number(ctx.query?.beforeTs);
      const beforeTs = Number.isFinite(beforeTsRaw) ? beforeTsRaw : null;

      const sinceMinutesRaw = Number(ctx.query?.sinceMinutes);
      const sinceMinutes = Number.isFinite(sinceMinutesRaw) && sinceMinutesRaw > 0
        ? sinceMinutesRaw
        : null;

      const sinceTs = sinceMinutes === null ? null : Date.now() - sinceMinutes * 60 * 1000;

      const entriesByType = typeFilter
        ? adminLog.filter((e) => e.type === typeFilter)
        : adminLog;

      const entriesBySince = sinceTs === null
        ? entriesByType
        : entriesByType.filter((e) => e.ts >= sinceTs);

      const entriesByCursor = beforeTs === null
        ? entriesBySince
        : entriesBySince.filter((e) => e.ts < beforeTs);

      const sliceFrom = Math.max(entriesByCursor.length - limit, 0);
      ctx.body = entriesByCursor.slice(sliceFrom).reverse();
    });

    router.get('/api/admin/frontend-metrics', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canViewLogs')) return;

      const sourceFilter = String(ctx.query?.source ?? '').trim().toLowerCase();
      const nameFilter = String(ctx.query?.name ?? '').trim().toLowerCase();
      const limitRaw = Number(ctx.query?.limit);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), 200)
        : 50;

      const filtered = frontendMetrics.filter((entry) => {
        if (sourceFilter && entry.source.toLowerCase() !== sourceFilter) return false;
        if (nameFilter && !entry.name.toLowerCase().includes(nameFilter)) return false;
        return true;
      });

      const sliceFrom = Math.max(filtered.length - limit, 0);
      ctx.body = {
        summary: summarizeFrontendMetrics(filtered),
        entries: filtered.slice(sliceFrom).reverse(),
      };
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
