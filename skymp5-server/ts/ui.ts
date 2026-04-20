const Koa = require("koa");
const serve = require("koa-static");
const Router = require("koa-router");
const auth = require("koa-basic-auth");
import * as koaBody from "koa-body";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { spawn } from "child_process";
import { Settings } from "./settings";
import Axios from "axios";
import { AddressInfo } from "net";
import { register, getAggregatedMetrics, rpcCallsCounter, rpcDurationHistogram } from "./systems/metricsSystem";

let gScampServer: any = null;

let metricsAuth: { user: string; password: string } | null = null;
let adminAuth: { user: string; password: string } | null = null;
let adminAuthSource: 'none' | 'adminUiAuth' | 'metricsAuth' = 'none';
type StoredAdminAuthAlgo = 'scrypt-v1';
interface StoredAdminAuth {
  user: string;
  passwordHash: string;
  algo: StoredAdminAuthAlgo;
  createdAt: number;
  updatedAt: number;
}

let storedAdminAuth: StoredAdminAuth | null = null;
const ADMIN_AUTH_FILE = 'admin-auth.json';
const ADMIN_MENU_DEBUG_LOG_FILE = 'admin-menu-debug.log';
const ADMIN_PLAYER_STATS_FILE = 'admin-player-stats.json';
const ADMIN_HISTORY_FILE = 'admin-history.json';
const PLAYER_STATS_PERSIST_INTERVAL_MS = 30 * 1000;
const ADMIN_PASSWORD_MIN_LENGTH = 10;
const ADMIN_SESSION_COOKIE = 'skymp_admin_session';
const ADMIN_SESSION_IDLE_MS = 10 * 60 * 1000;
const adminSessions = new Map<string, {
  id: string;
  user: string;
  createdAt: number;
  lastActivityAt: number;
}>();
const processStartedAt = Date.now();
// ---------------------------------------------------------------------------
// Admin event log (in-memory, capped at MAX_ADMIN_LOG entries)
// ---------------------------------------------------------------------------
interface AdminLogEntry { ts: number; type: 'kick' | 'ban' | 'mute' | 'console'; message: string; }
type ServerLogLevel = 'info' | 'error';
interface ServerLogEntry { ts: number; type: 'server'; level: ServerLogLevel; message: string; }
const adminLog: AdminLogEntry[] = [];
const MAX_ADMIN_LOG = 500;
const serverLog: ServerLogEntry[] = [];
const MAX_SERVER_LOG = 2000;
const serverLogBuffers: Record<ServerLogLevel, string> = {
  info: '',
  error: '',
};

interface FrontendMetricEntry {
  name: string;
  value: number;
  source: string;
  ts: number;
  receivedAt: number;
  url?: string;
  path?: string;
  clientSource?: string;
  userAgent?: string;
  language?: string;
  platform?: string;
  visibilityState?: string;
  sessionId?: string;
}

interface ClientRuntimeEventEntry {
  userId: number;
  ip?: string;
  source: string;
  sessionId?: string;
  event: string;
  level: 'info' | 'warn' | 'error';
  ts: number;
  receivedAt: number;
  details?: string;
}

type RevivalEventType = 'downed' | 'revived' | 'respawn_disabled' | 'respawn_enabled' | 'auto_revived';

interface RevivalEventEntry {
  ts: number;
  type: RevivalEventType;
  userId: number;
  actorName?: string;
  details?: string;
}

interface DownedPlayerEntry {
  userId: number;
  actorName: string;
  downedAt: number;
  canRespawn: boolean;
}

interface TrackedRespawnState {
  actorName: string;
  isDead: boolean;
  canRespawn: boolean;
  downedAt: number | null;
}

interface AdminResourceEntry {
  key: string;
  name: string;
  path: string;
  kind: 'mod' | 'script';
  size: number;
  mtimeMs: number;
}

interface AdminPlayerStatsEntry {
  userId: number;
  firstJoinedAt: number;
  lastConnectionAt: number;
  totalPlayMs: number;
  activeSessionStartedAt: number | null;
  lastDisplayName: string;
}

type AdminHistoryActionType = 'warn' | 'ban' | 'kick' | 'mute';

interface AdminHistoryEntry {
  id: string;
  type: AdminHistoryActionType;
  playerName: string;
  userId: number;
  reason: string;
  author: string;
  ts: number;
}

const adminHistory: AdminHistoryEntry[] = [];
const MAX_ADMIN_HISTORY = 2000;

const generateHistoryId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const part = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${part(4)}-${part(4)}`;
};

const addAdminHistory = (entry: Omit<AdminHistoryEntry, 'id' | 'ts'>): void => {
  adminHistory.push({ ...entry, id: generateHistoryId(), ts: Date.now() });
  if (adminHistory.length > MAX_ADMIN_HISTORY) adminHistory.shift();
};

const loadHistory = (dataDir: string): void => {
  try {
    const filePath = path.join(dataDir, ADMIN_HISTORY_FILE);
    if (!fs.existsSync(filePath)) return;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(parsed)) {
      adminHistory.splice(0, adminHistory.length, ...parsed.slice(-MAX_ADMIN_HISTORY));
    }
  } catch { /* ignore */ }
};

const saveHistory = (dataDir: string): void => {
  try {
    fs.writeFileSync(path.join(dataDir, ADMIN_HISTORY_FILE), JSON.stringify(adminHistory), 'utf8');
  } catch { /* ignore */ }
};

// ---------------------------------------------------------------------------
// Player Drop tracking
// ---------------------------------------------------------------------------
type PlayerDropType = 'expected' | 'unexpected';

interface PlayerDropEntry {
  ts: number;
  userId: number;
  playerName: string;
  type: PlayerDropType;
  reason?: string;
}

interface EnvironmentChangeEntry {
  ts: number;
  type: string;
  description: string;
}

const MAX_PLAYER_DROPS = 5000;
const playerDrops: PlayerDropEntry[] = [];
const environmentChanges: EnvironmentChangeEntry[] = [];
const MAX_ENVIRONMENT_CHANGES = 500;

const addPlayerDrop = (entry: Omit<PlayerDropEntry, 'ts'>): void => {
  playerDrops.push({ ...entry, ts: Date.now() });
  if (playerDrops.length > MAX_PLAYER_DROPS) playerDrops.shift();
};

const addEnvironmentChange = (type: string, description: string): void => {
  environmentChanges.push({ ts: Date.now(), type, description });
  if (environmentChanges.length > MAX_ENVIRONMENT_CHANGES) environmentChanges.shift();
};

interface OfflineInventorySnapshot {
  profileId: number;
  formDesc: string;
  inventory: Record<string, unknown>;
  updatedAt: number;
  filePath: string;
}

interface LocaleRoutingSettings {
  defaultLanguage: string;
  countryCodeToLanguage: Record<string, string>;
}

type JoinAccessMode = 'open' | 'adminOnly' | 'approvedLicense' | 'discordMember' | 'discordRoles';

interface JoinAccessSettings {
  mode: JoinAccessMode;
  rejectionMessage: string;
  approvedLicenses: string[];
  approvedDiscordIds: string[];
  discordRoleIds: string[];
}

interface DiscordBotSettings {
  enabled: boolean;
  token: string;
  guildId: string;
  warningsChannelId: string;
}

interface SupervisorSettings {
  enabled: boolean;
  stopCommand: string;
  restartCommand: string;
}

const frontendMetrics: FrontendMetricEntry[] = [];
const MAX_FRONTEND_METRICS = 1000;
const FRONTEND_METRICS_INFO_LOG_INTERVAL_MS = 30 * 60 * 1000;
let lastFrontendMetricsInfoLogAt = 0;
const clientRuntimeEvents: ClientRuntimeEventEntry[] = [];
const MAX_CLIENT_RUNTIME_EVENTS = 2000;
const revivalEvents: RevivalEventEntry[] = [];
const MAX_REVIVAL_EVENTS = 1000;
const trackedRespawnStates = new Map<number, TrackedRespawnState>();

interface AdminCapabilities {
  canKick: boolean;
  canBan: boolean;
  canUnban: boolean;
  canConsole: boolean;
  canViewLogs: boolean;
  canMessage: boolean;
  canMute: boolean;
  canUnmute: boolean;
  canManageRespawn: boolean;
}

type AdminRole = 'admin' | 'moderator' | 'viewer';

interface AdminUiUserProfile {
  role: AdminRole;
  discordId?: string;
}

interface DiscordAdminOauthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
}

const ADMIN_DISCORD_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const adminDiscordOauthStates = new Map<string, number>();

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
    canManageRespawn: true,
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
    canManageRespawn: true,
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
    canManageRespawn: false,
  },
};

const addAdminLog = (type: AdminLogEntry['type'], message: string): void => {
  adminLog.push({ ts: Date.now(), type, message });
  if (adminLog.length > MAX_ADMIN_LOG) adminLog.shift();
};

const getAdminMenuDebugLogPath = (dataDir: string): string => path.join(dataDir, ADMIN_MENU_DEBUG_LOG_FILE);

const appendAdminMenuDebugLog = (dataDir: string, user: string, payload: any): void => {
  try {
    const logPath = getAdminMenuDebugLogPath(dataDir);
    const entry = {
      ts: Date.now(),
      user: String(user || ''),
      source: String(payload?.source || ''),
      visible: Boolean(payload?.visible),
      previous: payload?.previous ?? null,
      next: payload?.next ?? null,
      clientTs: Number(payload?.ts) || null,
    };
    fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, { encoding: 'utf8' });
  } catch (error) {
    console.error('Failed to append admin menu debug log:', error);
  }
};

const addServerLog = (level: ServerLogLevel, message: string): void => {
  const cleaned = String(message || '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .trim();

  if (!cleaned) return;

  serverLog.push({
    ts: Date.now(),
    type: 'server',
    level,
    message: cleaned.slice(0, 4000),
  });

  if (serverLog.length > MAX_SERVER_LOG) {
    serverLog.splice(0, serverLog.length - MAX_SERVER_LOG);
  }
};

const pushServerLogChunkInternal = (level: ServerLogLevel, chunk: string): void => {
  const normalizedChunk = String(chunk || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const parts = `${serverLogBuffers[level]}${normalizedChunk}`.split('\n');
  serverLogBuffers[level] = parts.pop() ?? '';

  parts.forEach((part) => {
    addServerLog(level, part);
  });
};

const addFrontendMetrics = (entries: FrontendMetricEntry[]): void => {
  frontendMetrics.push(...entries);
  if (frontendMetrics.length > MAX_FRONTEND_METRICS) {
    frontendMetrics.splice(0, frontendMetrics.length - MAX_FRONTEND_METRICS);
  }
};

const addClientRuntimeEvents = (entries: ClientRuntimeEventEntry[]): void => {
  clientRuntimeEvents.push(...entries);
  if (clientRuntimeEvents.length > MAX_CLIENT_RUNTIME_EVENTS) {
    clientRuntimeEvents.splice(0, clientRuntimeEvents.length - MAX_CLIENT_RUNTIME_EVENTS);
  }
};

const addRevivalEvent = (entry: RevivalEventEntry): void => {
  revivalEvents.push(entry);
  if (revivalEvents.length > MAX_REVIVAL_EVENTS) {
    revivalEvents.splice(0, revivalEvents.length - MAX_REVIVAL_EVENTS);
  }
};

const getActorBooleanProperty = (actorId: number, propertyName: string, fallback: boolean): boolean => {
  if (!actorId) return fallback;
  const value = safeCall(() => (gScampServer as any)?.get?.(actorId, propertyName), fallback);
  return typeof value === 'boolean' ? value : fallback;
};

const setActorProperty = (actorId: number, propertyName: string, value: unknown): void => {
  safeCall(() => (gScampServer as any)?.set?.(actorId, propertyName, value), undefined);
};

const syncRespawnState = (): DownedPlayerEntry[] => {
  const now = Date.now();
  const onlineUserIds = getOnlinePlayerIds();
  const stillOnline = new Set<number>();
  const downedPlayers: DownedPlayerEntry[] = [];

  onlineUserIds.forEach((userId) => {
    stillOnline.add(userId);
    const actorId = safeCall(() => gScampServer.getUserActor(userId), 0);
    if (!actorId) {
      trackedRespawnStates.delete(userId);
      return;
    }

    const actorName = safeCall(() => gScampServer.getActorName(actorId), '') || `userId=${userId}`;
    const isDead = getActorBooleanProperty(actorId, 'isDead', false);
    const canRespawn = getActorBooleanProperty(actorId, 'canRespawn', true);
    const previous = trackedRespawnStates.get(userId);

    let downedAt = previous?.downedAt ?? null;
    if (isDead && (!previous || !previous.isDead)) {
      downedAt = now;
      addRevivalEvent({
        ts: now,
        type: 'downed',
        userId,
        actorName,
        details: canRespawn ? 'Auto-respawn currently enabled' : 'Auto-respawn disabled',
      });
    }

    if (previous?.isDead && previous.canRespawn !== canRespawn) {
      addRevivalEvent({
        ts: now,
        type: canRespawn ? 'respawn_enabled' : 'respawn_disabled',
        userId,
        actorName,
      });
    }

    if (previous?.isDead && !isDead) {
      addRevivalEvent({
        ts: now,
        type: 'auto_revived',
        userId,
        actorName,
        details: 'Player returned to alive state outside the admin revive action',
      });
      downedAt = null;
    }

    trackedRespawnStates.set(userId, {
      actorName,
      isDead,
      canRespawn,
      downedAt,
    });

    if (isDead) {
      downedPlayers.push({
        userId,
        actorName,
        downedAt: downedAt ?? now,
        canRespawn,
      });
    }
  });

  Array.from(trackedRespawnStates.keys()).forEach((userId) => {
    if (!stillOnline.has(userId)) trackedRespawnStates.delete(userId);
  });

  return downedPlayers.sort((left, right) => left.downedAt - right.downedAt);
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

const summarizeClientRuntimeEvents = (entries: ClientRuntimeEventEntry[]) => {
  const sourceCounts = new Map<string, number>();
  const eventCounts = new Map<string, number>();

  let errorCount = 0;
  let warnCount = 0;
  let lastReceivedAt: number | null = null;

  entries.forEach((entry) => {
    sourceCounts.set(entry.source, (sourceCounts.get(entry.source) || 0) + 1);
    eventCounts.set(entry.event, (eventCounts.get(entry.event) || 0) + 1);
    if (entry.level === 'error') errorCount += 1;
    if (entry.level === 'warn') warnCount += 1;
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
    warnCount,
    lastReceivedAt,
    sources: toTopList(sourceCounts),
    events: toTopList(eventCounts),
  };
};

// bannedUsers: null = permanent ban; number = expiresAt timestamp (timed ban)
const bannedUsers = new Map<number, number | null>();
const mutedUsers = new Map<number, number>(); // userId -> expiresAt (ms timestamp)
const adminPlayerStats = new Map<number, AdminPlayerStatsEntry>();
let lastPlayerStatsPersistAt = 0;

const cleanupExpiredBans = (): void => {
  const now = Date.now();
  bannedUsers.forEach((expiresAt, userId) => {
    if (expiresAt !== null && expiresAt <= now) bannedUsers.delete(userId);
  });
};

const cleanupExpiredMutes = (): void => {
  const now = Date.now();
  mutedUsers.forEach((expiresAt, userId) => {
    if (expiresAt <= now) mutedUsers.delete(userId);
  });
};

// ---------------------------------------------------------------------------
// Persistence helpers – ban/mute lists survive server restarts
// ---------------------------------------------------------------------------
const saveBans = (dataDir: string): void => {
  try {
    cleanupExpiredBans();
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'admin-bans.json'),
      JSON.stringify(Array.from(bannedUsers.entries())),
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
      const raw = JSON.parse(fs.readFileSync(bansPath, 'utf8'));
      if (Array.isArray(raw)) {
        if (raw.length === 0 || typeof raw[0] === 'number') {
          // Old format: plain number[] — migrate to permanent bans
          (raw as number[]).forEach((id) => bannedUsers.set(id, null));
        } else {
          // New format: [userId, expiresAt | null][]
          const now = Date.now();
          (raw as [number, number | null][]).forEach(([userId, expiresAt]) => {
            if (expiresAt === null || expiresAt > now) bannedUsers.set(userId, expiresAt);
          });
        }
      }
      console.log(`Loaded ${bannedUsers.size} banned userId(s) from ${bansPath}`);
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

const savePlayerStats = (dataDir: string, force = false): void => {
  const now = Date.now();
  if (!force && now - lastPlayerStatsPersistAt < PLAYER_STATS_PERSIST_INTERVAL_MS) return;

  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const entries = Array.from(adminPlayerStats.values()).map((entry) => ({
      userId: entry.userId,
      firstJoinedAt: entry.firstJoinedAt,
      lastConnectionAt: entry.lastConnectionAt,
      totalPlayMs: Math.max(0, Math.floor(entry.totalPlayMs)),
      activeSessionStartedAt: entry.activeSessionStartedAt,
      lastDisplayName: entry.lastDisplayName,
    }));
    fs.writeFileSync(path.join(dataDir, ADMIN_PLAYER_STATS_FILE), JSON.stringify(entries), 'utf8');
    lastPlayerStatsPersistAt = now;
  } catch (e) {
    console.error('Failed to persist admin player stats:', e);
  }
};

const loadPlayerStats = (dataDir: string): void => {
  try {
    const statsPath = path.join(dataDir, ADMIN_PLAYER_STATS_FILE);
    if (!fs.existsSync(statsPath)) return;

    const raw = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    if (!Array.isArray(raw)) return;

    adminPlayerStats.clear();
    raw.forEach((value) => {
      if (!value || typeof value !== 'object') return;
      const userId = Number((value as any).userId);
      const firstJoinedAt = Number((value as any).firstJoinedAt);
      const lastConnectionAt = Number((value as any).lastConnectionAt);
      const totalPlayMs = Number((value as any).totalPlayMs);
      const activeSessionStartedAtRaw = (value as any).activeSessionStartedAt;
      const activeSessionStartedAt = Number.isFinite(Number(activeSessionStartedAtRaw))
        ? Number(activeSessionStartedAtRaw)
        : null;

      if (!Number.isFinite(userId) || !Number.isFinite(firstJoinedAt)) return;

      adminPlayerStats.set(Math.floor(userId), {
        userId: Math.floor(userId),
        firstJoinedAt: Math.floor(firstJoinedAt),
        lastConnectionAt: Number.isFinite(lastConnectionAt) ? Math.floor(lastConnectionAt) : Math.floor(firstJoinedAt),
        totalPlayMs: Number.isFinite(totalPlayMs) ? Math.max(0, Math.floor(totalPlayMs)) : 0,
        activeSessionStartedAt,
        lastDisplayName: typeof (value as any).lastDisplayName === 'string' ? (value as any).lastDisplayName.slice(0, 120) : '',
      });
    });
    console.log(`Loaded ${adminPlayerStats.size} admin player stat entrie(s) from ${statsPath}`);
  } catch (e) {
    console.error('Failed to load admin player stats:', e);
  }
};

const updatePlayerStatsSnapshot = (dataDir: string): void => {
  const now = Date.now();
  const onlineUserIds = getOnlinePlayerIds();
  const onlineUserIdSet = new Set<number>(onlineUserIds);
  let changed = false;

  onlineUserIds.forEach((userId) => {
    const safeUserId = Number.isFinite(userId) ? Math.floor(userId) : -1;
    if (safeUserId < 0) return;

    const actorId = safeCall(() => gScampServer.getUserActor(safeUserId), 0);
    const actorName = actorId ? String(safeCall(() => gScampServer.getActorName(actorId), '') || '') : '';
    const existing = adminPlayerStats.get(safeUserId);

    if (!existing) {
      adminPlayerStats.set(safeUserId, {
        userId: safeUserId,
        firstJoinedAt: now,
        lastConnectionAt: now,
        totalPlayMs: 0,
        activeSessionStartedAt: now,
        lastDisplayName: actorName.slice(0, 120),
      });
      changed = true;
      return;
    }

    if (existing.activeSessionStartedAt === null) {
      existing.activeSessionStartedAt = now;
      changed = true;
    }

    if (existing.lastConnectionAt !== now) {
      existing.lastConnectionAt = now;
      changed = true;
    }

    if (actorName && actorName !== existing.lastDisplayName) {
      existing.lastDisplayName = actorName.slice(0, 120);
      changed = true;
    }
  });

  adminPlayerStats.forEach((entry, userId) => {
    if (!onlineUserIdSet.has(userId) && entry.activeSessionStartedAt !== null) {
      entry.totalPlayMs += Math.max(0, now - entry.activeSessionStartedAt);
      entry.activeSessionStartedAt = null;
      entry.lastConnectionAt = now;
      changed = true;
      // Record the disconnect as an expected drop
      addPlayerDrop({ userId, playerName: entry.lastDisplayName || `userId=${userId}`, type: 'expected' });
    }
  });

  if (changed) {
    savePlayerStats(dataDir);
  }
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
  adminAuthSource = 'none';
  const authConfig = settings.allSettings?.adminUiAuth as { user?: string; password?: string } | undefined;
  if (authConfig?.user && authConfig?.password) {
    adminAuth = { user: authConfig.user, password: authConfig.password };
    adminAuthSource = 'adminUiAuth';
    return;
  }

  if (metricsAuth?.user && metricsAuth?.password) {
    adminAuth = metricsAuth;
    adminAuthSource = 'metricsAuth';
    console.log('adminUiAuth is not configured, falling back to metricsAuth credentials');
    return;
  }

  console.log('Admin dashboard auth is not configured and metricsAuth fallback is unavailable');
};

const getAdminAuthFilePath = (dataDir: string): string => path.join(dataDir, ADMIN_AUTH_FILE);

const isValidStoredAdminAuth = (value: any): value is StoredAdminAuth => {
  return value
    && typeof value.user === 'string'
    && typeof value.passwordHash === 'string'
    && value.algo === 'scrypt-v1';
};

const loadStoredAdminAuth = (dataDir: string): void => {
  storedAdminAuth = null;
  const authPath = getAdminAuthFilePath(dataDir);
  if (!fs.existsSync(authPath)) return;

  try {
    const parsed = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    if (isValidStoredAdminAuth(parsed)) {
      storedAdminAuth = {
        user: parsed.user,
        passwordHash: parsed.passwordHash,
        algo: parsed.algo,
        createdAt: Number(parsed.createdAt) || Date.now(),
        updatedAt: Number(parsed.updatedAt) || Date.now(),
      };
      console.log(`Loaded secure admin auth store from ${authPath}`);
    } else {
      console.error(`Invalid secure admin auth store format in ${authPath}`);
    }
  } catch (e) {
    console.error('Failed to load secure admin auth store:', e);
  }
};

const saveStoredAdminAuth = (dataDir: string, value: StoredAdminAuth): void => {
  const authPath = getAdminAuthFilePath(dataDir);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(authPath, JSON.stringify(value, null, 2), 'utf8');
};

const createScryptPasswordHash = (password: string): string => {
  const n = 16384;
  const r = 8;
  const p = 1;
  const keyLen = 64;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, keyLen, { N: n, r, p }).toString('hex');
  return `scrypt-v1$${n}$${r}$${p}$${salt}$${hash}`;
};

const verifyScryptPasswordHash = (password: string, encodedHash: string): boolean => {
  const parts = String(encodedHash || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt-v1') return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4];
  const expectedHex = parts[5];

  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || !salt || !expectedHex) {
    return false;
  }

  try {
    const expected = Buffer.from(expectedHex, 'hex');
    const derived = crypto.scryptSync(password, salt, expected.length, { N: n, r, p });
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
};

const hasConfiguredAdminCredentials = (): boolean => Boolean(storedAdminAuth || adminAuth);

const getConfiguredAdminUser = (): string => storedAdminAuth?.user || adminAuth?.user || '';

const verifyAdminCredentials = (user: string, password: string): boolean => {
  if (storedAdminAuth) {
    if (user !== storedAdminAuth.user) return false;
    return verifyScryptPasswordHash(password, storedAdminAuth.passwordHash);
  }

  if (adminAuth) {
    return user === adminAuth.user && password === adminAuth.password;
  }

  return false;
};

const getOnlinePlayerIds = (): number[] => {
  const onlinePlayers = gScampServer?.get?.(0, "onlinePlayers");
  if (!Array.isArray(onlinePlayers)) {
    return [];
  }

  const uniqueUserIds = new Set<number>();

  for (const value of onlinePlayers) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      continue;
    }

    const candidate = Math.floor(value);

    // onlinePlayers currently stores actor form IDs; convert them to user IDs
    const mappedUserId = safeCall(() => gScampServer.getUserByActor(candidate), -1);
    if (Number.isFinite(mappedUserId) && mappedUserId >= 0) {
      const mappedActorId = safeCall(() => gScampServer.getUserActor(mappedUserId), 0);
      if (mappedActorId === candidate) {
        uniqueUserIds.add(mappedUserId);
        continue;
      }
    }

    // Backward-compatible fallback in case onlinePlayers already contains user IDs
    const actorId = safeCall(() => gScampServer.getUserActor(candidate), 0);
    if (actorId) {
      uniqueUserIds.add(candidate);
    }
  }

  return Array.from(uniqueUserIds);
};

const safeCall = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

const RESOURCE_SCRIPT_EXTENSIONS = new Set(['.pex']);
const RESOURCE_MOD_EXTENSIONS = new Set(['.esm']);
const MAX_RESOURCE_SCAN_DEPTH = 5;
const MAX_RESOURCE_SCAN_ENTRIES = 1500;
const DEFAULT_LOCALE_ROUTING: LocaleRoutingSettings = {
  defaultLanguage: 'en',
  countryCodeToLanguage: {
    DE: 'de',
    AT: 'de',
    CH: 'de',
    US: 'en',
    GB: 'en',
    ES: 'es',
    MX: 'es',
    AR: 'es',
    CO: 'es',
    RU: 'ru',
    BY: 'ru',
    UA: 'ru',
    KZ: 'ru',
  },
};
const DEFAULT_JOIN_ACCESS: JoinAccessSettings = {
  mode: 'open',
  rejectionMessage: 'Access denied. Please contact server staff for whitelist approval.',
  approvedLicenses: [],
  approvedDiscordIds: [],
  discordRoleIds: [],
};

const DEFAULT_DISCORD_BOT: DiscordBotSettings = {
  enabled: false,
  token: '',
  guildId: '',
  warningsChannelId: '',
};

const resourceKindByExt = (ext: string): 'mod' | 'script' | null => {
  const normalized = ext.toLowerCase();
  if (RESOURCE_MOD_EXTENSIONS.has(normalized)) return 'mod';
  if (RESOURCE_SCRIPT_EXTENSIONS.has(normalized)) return 'script';
  return null;
};

const addResourceFromPath = (
  filePath: string,
  resources: Map<string, AdminResourceEntry>,
): void => {
  if (resources.size >= MAX_RESOURCE_SCAN_ENTRIES) return;

  const ext = path.extname(filePath);
  const kind = resourceKindByExt(ext);
  if (!kind) return;

  const stat = safeCall(() => fs.statSync(filePath), null as fs.Stats | null);
  if (!stat || !stat.isFile()) return;

  const key = path.resolve(filePath).toLowerCase();
  if (resources.has(key)) return;

  resources.set(key, {
    key,
    name: path.basename(filePath),
    path: path.relative(process.cwd(), filePath) || path.basename(filePath),
    kind,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
  });
};

const scanResourcesRecursively = (
  dirPath: string,
  resources: Map<string, AdminResourceEntry>,
  depth = 0,
): void => {
  if (depth > MAX_RESOURCE_SCAN_DEPTH) return;
  if (resources.size >= MAX_RESOURCE_SCAN_ENTRIES) return;

  const entries = safeCall(
    () => fs.readdirSync(dirPath, { withFileTypes: true }),
    [] as fs.Dirent[],
  );

  for (const entry of entries) {
    if (resources.size >= MAX_RESOURCE_SCAN_ENTRIES) return;

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.')) continue;
      scanResourcesRecursively(fullPath, resources, depth + 1);
      continue;
    }

    if (entry.isFile()) {
      addResourceFromPath(fullPath, resources);
    }
  }
};

const listAdminResources = (settings: Settings, dataDir: string): AdminResourceEntry[] => {
  const resources = new Map<string, AdminResourceEntry>();

  const candidates = [
    path.resolve(dataDir),
    path.resolve('./'),
    path.resolve('./scripts'),
    path.resolve('./data'),
    path.resolve('./skymp5-gamemode'),
  ];

  for (const candidate of candidates) {
    const exists = safeCall(() => fs.existsSync(candidate), false);
    if (!exists) continue;

    const stat = safeCall(() => fs.statSync(candidate), null as fs.Stats | null);
    if (!stat) continue;

    if (stat.isFile()) {
      addResourceFromPath(candidate, resources);
      continue;
    }

    if (stat.isDirectory()) {
      scanResourcesRecursively(candidate, resources);
    }
  }

  const loadOrder = Array.isArray(settings.loadOrder)
    ? settings.loadOrder.filter((v: unknown) => typeof v === 'string') as string[]
    : [];

  for (const modName of loadOrder) {
    const fromDataDir = path.resolve(dataDir, modName);
    addResourceFromPath(fromDataDir, resources);

    const fromCwd = path.resolve('./', modName);
    addResourceFromPath(fromCwd, resources);

    const key = path.resolve(modName).toLowerCase();
    if (!resources.has(key)) {
      resources.set(key, {
        key,
        name: path.basename(modName),
        path: modName,
        kind: 'mod',
        size: 0,
        mtimeMs: 0,
      });
    }
  }

  return Array.from(resources.values()).sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'mod' ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
};

const getInventoryEntriesCount = (inventory: unknown): number => {
  if (!inventory || typeof inventory !== 'object') return 0;

  const entries = (inventory as Record<string, unknown>).entries;
  return Array.isArray(entries) ? entries.length : 0;
};

const getOfflineInventorySnapshot = (dataDir: string, profileId: number): OfflineInventorySnapshot | null => {
  const changeFormsDir = path.resolve(dataDir, 'changeForms');
  const entries = safeCall(
    () => fs.readdirSync(changeFormsDir, { withFileTypes: true }),
    [] as fs.Dirent[],
  );

  let best: OfflineInventorySnapshot | null = null;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith('.json')) continue;

    const filePath = path.join(changeFormsDir, entry.name);
    const text = safeCall(() => fs.readFileSync(filePath, 'utf8'), '');
    if (!text) continue;

    const parsed = safeCall(() => JSON.parse(text) as Record<string, unknown>, null as Record<string, unknown> | null);
    if (!parsed) continue;

    const parsedProfileId = Number(parsed.profileId);
    if (!Number.isFinite(parsedProfileId) || parsedProfileId !== profileId) continue;

    const inventory = parsed.inv;
    if (!inventory || typeof inventory !== 'object') continue;

    const stat = safeCall(() => fs.statSync(filePath), null as fs.Stats | null);
    const updatedAt = stat?.mtimeMs ?? 0;
    const formDesc = typeof parsed.formDesc === 'string' ? parsed.formDesc : entry.name.replace(/\.json$/i, '').replace(/_/g, ':');
    const snapshot: OfflineInventorySnapshot = {
      profileId,
      formDesc,
      inventory: inventory as Record<string, unknown>,
      updatedAt,
      filePath,
    };

    if (!best || snapshot.updatedAt >= best.updatedAt) {
      best = snapshot;
    }
  }

  return best;
};

const cloneLocaleRoutingDefaults = (): LocaleRoutingSettings => ({
  defaultLanguage: DEFAULT_LOCALE_ROUTING.defaultLanguage,
  countryCodeToLanguage: { ...DEFAULT_LOCALE_ROUTING.countryCodeToLanguage },
});

const sanitizeCountryCodeToLanguage = (
  input: Record<string, unknown> | undefined,
): Record<string, string> => {
  if (!input) {
    return { ...DEFAULT_LOCALE_ROUTING.countryCodeToLanguage };
  }

  const result: Record<string, string> = {};
  Object.entries(input).forEach(([rawCountry, rawLanguage]) => {
    const country = String(rawCountry || '').trim().toUpperCase();
    const language = String(rawLanguage || '').trim().toLowerCase();
    if (!country || country.length > 3 || !language) return;
    result[country] = language;
  });

  if (Object.keys(result).length === 0) {
    return { ...DEFAULT_LOCALE_ROUTING.countryCodeToLanguage };
  }
  return result;
};

const ensureLocaleRoutingSettingsInObject = (settingsObj: Record<string, unknown>): LocaleRoutingSettings => {
  const current = settingsObj.localeRouting as Record<string, unknown> | undefined;
  const defaultLanguageRaw = current?.defaultLanguage;
  const defaultLanguage = String(defaultLanguageRaw || DEFAULT_LOCALE_ROUTING.defaultLanguage).trim().toLowerCase() || DEFAULT_LOCALE_ROUTING.defaultLanguage;
  const countryCodeToLanguage = sanitizeCountryCodeToLanguage(
    current?.countryCodeToLanguage as Record<string, unknown> | undefined,
  );

  const normalized: LocaleRoutingSettings = {
    defaultLanguage,
    countryCodeToLanguage,
  };

  settingsObj.localeRouting = normalized;
  return normalized;
};

const toUniqueTrimmedList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const set = new Set<string>();
  value.forEach((entry) => {
    const text = String(entry || '').trim();
    if (!text) return;
    set.add(text);
  });
  return Array.from(set.values());
};

const sanitizeJoinAccessSettings = (
  value: Record<string, unknown> | undefined,
): JoinAccessSettings => {
  const modeRaw = String(value?.mode || DEFAULT_JOIN_ACCESS.mode).trim();
  const mode: JoinAccessMode = (
    modeRaw === 'adminOnly'
    || modeRaw === 'approvedLicense'
    || modeRaw === 'discordMember'
    || modeRaw === 'discordRoles'
    || modeRaw === 'open'
  ) ? modeRaw : DEFAULT_JOIN_ACCESS.mode;

  return {
    mode,
    rejectionMessage: String(value?.rejectionMessage || DEFAULT_JOIN_ACCESS.rejectionMessage).trim(),
    approvedLicenses: toUniqueTrimmedList(value?.approvedLicenses),
    approvedDiscordIds: toUniqueTrimmedList(value?.approvedDiscordIds),
    discordRoleIds: toUniqueTrimmedList(value?.discordRoleIds),
  };
};

const ensureJoinAccessSettingsInObject = (settingsObj: Record<string, unknown>): JoinAccessSettings => {
  const current = settingsObj.joinAccess as Record<string, unknown> | undefined;
  const normalized = sanitizeJoinAccessSettings(current);
  settingsObj.joinAccess = normalized;
  return normalized;
};

const sanitizeDiscordBotSettings = (
  value: Record<string, unknown> | undefined,
  discordAuth: Record<string, unknown> | undefined,
): DiscordBotSettings => {
  const tokenFromAuth = String(discordAuth?.botToken || '').trim();
  const guildFromAuth = String(discordAuth?.guildId || '').trim();
  const warningsFromAuth = String(discordAuth?.eventLogChannelId || '').trim();

  return {
    enabled: Boolean(value?.enabled),
    token: String(value?.token || tokenFromAuth),
    guildId: String(value?.guildId || guildFromAuth),
    warningsChannelId: String(value?.warningsChannelId || warningsFromAuth),
  };
};

const ensureDiscordBotSettingsInObject = (settingsObj: Record<string, unknown>): DiscordBotSettings => {
  const current = settingsObj.discordBot as Record<string, unknown> | undefined;
  const discordAuth = settingsObj.discordAuth as Record<string, unknown> | undefined;
  const normalized = sanitizeDiscordBotSettings(current, discordAuth);
  settingsObj.discordBot = normalized;
  settingsObj.discordAuth = {
    ...(discordAuth || {}),
    botToken: normalized.token,
    guildId: normalized.guildId,
    eventLogChannelId: normalized.warningsChannelId,
  };
  return normalized;
};

const sanitizeSupervisorSettings = (
  value: Record<string, unknown> | undefined,
): SupervisorSettings => {
  return {
    enabled: Boolean(value?.enabled),
    stopCommand: String(value?.stopCommand || '').trim(),
    restartCommand: String(value?.restartCommand || '').trim(),
  };
};

const ensureSupervisorSettingsInObject = (settingsObj: Record<string, unknown>): SupervisorSettings => {
  const current = settingsObj.supervisor as Record<string, unknown> | undefined;
  const normalized = sanitizeSupervisorSettings(current);
  settingsObj.supervisor = normalized;
  return normalized;
};

const getSupervisorSettings = (settings: Settings): SupervisorSettings => {
  const current = settings.allSettings?.supervisor as Record<string, unknown> | undefined;
  return sanitizeSupervisorSettings(current);
};

const isServerControlAvailable = (settings: Settings): boolean => {
  const supervisor = getSupervisorSettings(settings);
  return supervisor.enabled && Boolean(supervisor.stopCommand) && Boolean(supervisor.restartCommand);
};

const getServerSettingsPath = (): string => path.resolve('./server-settings.json');

const readServerSettingsJson = (): Record<string, unknown> => {
  const settingsPath = getServerSettingsPath();
  const text = fs.readFileSync(settingsPath, 'utf8');
  const parsed = JSON.parse(text) as Record<string, unknown>;
  return parsed;
};

const writeServerSettingsJson = (settingsObj: Record<string, unknown>): void => {
  const settingsPath = getServerSettingsPath();
  fs.writeFileSync(settingsPath, JSON.stringify(settingsObj, null, 2) + '\n', 'utf8');
};

const clearLegacyAdminUiAuthInServerSettings = (): boolean => {
  try {
    const parsed = readServerSettingsJson();
    if (Object.prototype.hasOwnProperty.call(parsed, 'adminUiAuth')) {
      delete (parsed as any).adminUiAuth;
      writeServerSettingsJson(parsed);
      return true;
    }
  } catch (e) {
    console.error('Failed to remove legacy adminUiAuth from server-settings.json:', e);
  }
  return false;
};

const resolveLanguageByCountryCode = (
  localeRouting: LocaleRoutingSettings,
  countryCodeRaw: string,
): string => {
  const countryCode = String(countryCodeRaw || '').trim().toUpperCase();
  if (!countryCode) return localeRouting.defaultLanguage;
  return localeRouting.countryCodeToLanguage[countryCode] || localeRouting.defaultLanguage;
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
    canManageRespawn: typeof overrides.canManageRespawn === 'boolean' ? overrides.canManageRespawn : base.canManageRespawn,
  };
};

const normalizeAdminRole = (value: unknown): AdminRole => {
  if (value === 'admin' || value === 'moderator' || value === 'viewer') return value;
  return 'viewer';
};

const sanitizeAdminUiUsers = (
  value: unknown,
): Record<string, AdminUiUserProfile> => {
  if (!value || typeof value !== 'object') return {};

  const out: Record<string, AdminUiUserProfile> = {};
  Object.entries(value as Record<string, unknown>).forEach(([rawUser, rawProfile]) => {
    const user = String(rawUser || '').trim();
    if (!user) return;

    const profileObj = rawProfile && typeof rawProfile === 'object'
      ? rawProfile as Record<string, unknown>
      : {};

    const role = normalizeAdminRole(profileObj.role);
    const discordId = String(profileObj.discordId || '').trim();

    out[user] = {
      role,
      ...(discordId ? { discordId } : {}),
    };
  });

  return out;
};

const sanitizeAdminUiRoles = (value: unknown): Record<string, AdminRole> => {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, AdminRole> = {};
  Object.entries(value as Record<string, unknown>).forEach(([rawUser, rawRole]) => {
    const user = String(rawUser || '').trim();
    if (!user) return;
    out[user] = normalizeAdminRole(rawRole);
  });
  return out;
};

const resolveAdminUsersFromSettingsObject = (
  settingsObj: Record<string, unknown>,
): Record<string, AdminUiUserProfile> => {
  const usersFromProfiles = sanitizeAdminUiUsers(settingsObj.adminUiUsers);
  const usersFromRoles = sanitizeAdminUiRoles(settingsObj.adminUiRoles);

  Object.entries(usersFromRoles).forEach(([user, role]) => {
    const existing = usersFromProfiles[user];
    usersFromProfiles[user] = {
      role,
      ...(existing?.discordId ? { discordId: existing.discordId } : {}),
    };
  });

  return usersFromProfiles;
};

const applyAdminUsersToSettingsObject = (
  settingsObj: Record<string, unknown>,
  users: Record<string, AdminUiUserProfile>,
): void => {
  const normalized = sanitizeAdminUiUsers(users);
  const normalizedRoles: Record<string, AdminRole> = {};
  Object.entries(normalized).forEach(([user, profile]) => {
    normalizedRoles[user] = profile.role;
  });
  settingsObj.adminUiUsers = normalized;
  settingsObj.adminUiRoles = normalizedRoles;
};

const resolveMasterAdminUserFromSettingsObject = (
  settingsObj: Record<string, unknown>,
  fallbackUser = '',
): string => {
  const fromSettings = String(settingsObj.adminUiMasterUser || '').trim();
  if (/^[a-zA-Z0-9._-]{3,32}$/.test(fromSettings)) return fromSettings;
  const fallback = String(fallbackUser || '').trim();
  if (/^[a-zA-Z0-9._-]{3,32}$/.test(fallback)) return fallback;
  return '';
};

const persistMasterAdminUserInServerSettings = (userRaw: string): boolean => {
  const user = String(userRaw || '').trim();
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(user)) return false;

  try {
    const parsed = readServerSettingsJson();
    const usersMap = resolveAdminUsersFromSettingsObject(parsed);
    const existing = usersMap[user];
    usersMap[user] = {
      role: 'admin',
      ...(existing?.discordId ? { discordId: existing.discordId } : {}),
    };

    applyAdminUsersToSettingsObject(parsed, usersMap);
    parsed.adminUiMasterUser = user;
    writeServerSettingsJson(parsed);
    return true;
  } catch (error) {
    console.error('Failed to persist master admin user in server-settings.json:', error);
    return false;
  }
};

const cleanupAdminDiscordOauthStates = (): void => {
  const now = Date.now();
  adminDiscordOauthStates.forEach((createdAt, state) => {
    if (now - createdAt > ADMIN_DISCORD_OAUTH_STATE_TTL_MS) {
      adminDiscordOauthStates.delete(state);
    }
  });
};

const resolveDiscordAdminOauthConfig = (settings: Settings): DiscordAdminOauthConfig => {
  const cfg = settings.allSettings?.adminUiDiscordAuth as Record<string, unknown> | undefined;
  const clientId = String(cfg?.clientId || process.env.SKYMP_ADMIN_DISCORD_CLIENT_ID || '').trim();
  const clientSecret = String(cfg?.clientSecret || process.env.SKYMP_ADMIN_DISCORD_CLIENT_SECRET || '').trim();
  const redirectUri = String(cfg?.redirectUri || process.env.SKYMP_ADMIN_DISCORD_REDIRECT_URI || '').trim();
  const scope = String(cfg?.scope || process.env.SKYMP_ADMIN_DISCORD_SCOPE || 'identify').trim() || 'identify';
  return {
    clientId,
    clientSecret,
    redirectUri,
    scope,
  };
};

const cleanupExpiredAdminSessions = (): void => {
  const now = Date.now();
  adminSessions.forEach((session, id) => {
    if (now - session.lastActivityAt > ADMIN_SESSION_IDLE_MS) {
      adminSessions.delete(id);
    }
  });
};

const createAdminSession = (user: string) => {
  cleanupExpiredAdminSessions();
  const now = Date.now();
  const id = crypto.randomBytes(24).toString('hex');
  const session = {
    id,
    user,
    createdAt: now,
    lastActivityAt: now,
  };
  adminSessions.set(id, session);
  return session;
};

const getAdminSessionFromCtx = (ctx: any) => {
  cleanupExpiredAdminSessions();
  const id = String(ctx?.cookies?.get?.(ADMIN_SESSION_COOKIE) || '').trim();
  if (!id) return null;
  const session = adminSessions.get(id);
  if (!session) return null;
  if (Date.now() - session.lastActivityAt > ADMIN_SESSION_IDLE_MS) {
    adminSessions.delete(id);
    return null;
  }
  return session;
};

const touchAdminSession = (session: { lastActivityAt: number }): void => {
  session.lastActivityAt = Date.now();
};

const setAdminSessionCookie = (ctx: any, sessionId: string): void => {
  ctx.cookies.set(ADMIN_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_IDLE_MS,
  });
};

const clearAdminSessionCookie = (ctx: any): void => {
  ctx.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
};

const decodeBasicAuth = (ctx: any): { user: string; password: string } | null => {
  const authHeader = String(ctx?.headers?.authorization ?? '');
  const m = authHeader.match(/^Basic\s+(.+)$/i);
  if (!m) return null;

  try {
    const decoded = Buffer.from(m[1], 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex < 0) return null;
    const user = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);
    return { user, password };
  } catch {
    return null;
  }
};

const getValidBasicAdminUser = (ctx: any): string => {
  if (!adminAuth) return '';
  const creds = decodeBasicAuth(ctx);
  if (!creds) return '';
  if (creds.user === adminAuth.user && creds.password === adminAuth.password) {
    return creds.user;
  }
  return '';
};

const getBasicAuthUser = (ctx: any): string => {
  const sessionUser = ctx?.state?.adminUser;
  if (typeof sessionUser === 'string' && sessionUser.length > 0) return sessionUser;

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
  const usersMap = sanitizeAdminUiUsers(settings.allSettings?.adminUiUsers);
  if (user && Object.prototype.hasOwnProperty.call(usersMap, user)) {
    return usersMap[user].role;
  }

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

const createApp = (settings: Settings, getOriginPort: () => number) => {
  const dataDir: string = settings.dataDir ?? './data';
  loadStoredAdminAuth(dataDir);
  loadModerationState(dataDir);
  loadPlayerStats(dataDir);
  loadHistory(dataDir);
  addEnvironmentChange('server-start', 'Server started');

  const app = new Koa();
  app.use(koaBody.default({ multipart: true }));

  // Middleware to auto-detect external URL from Host header
  app.use(async (ctx: any, next: any) => {
    const configuredUrl = (settings.allSettings.adminApi as any)?.externalUrl;
    if (configuredUrl) {
      ctx.state.externalUrl = configuredUrl;
    } else {
      // Auto-detect from Host header
      const host = ctx.request.header.host || 'localhost:8080';
      const protocol = ctx.request.header['x-forwarded-proto'] || (ctx.secure ? 'https' : 'http');
      ctx.state.externalUrl = `${protocol}://${host}`;
    }
    await next();
  });

  app.use(async (ctx: any, next: any) => {
    try {
      await next();
    } catch (err: any) {
      if (401 === err.status) {
        ctx.status = 401;
        const realm = ctx.path.startsWith('/admin') ? 'admin' : 'metrics';
        ctx.set("WWW-Authenticate", `Basic realm="${realm}"`);
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
    const requestSource = typeof ctx.request.body?.source === 'string'
      ? String(ctx.request.body.source).slice(0, 80)
      : undefined;
    const requestUrl = typeof ctx.request.body?.url === 'string'
      ? String(ctx.request.body.url).slice(0, 240)
      : undefined;
    const requestPath = typeof ctx.request.body?.path === 'string'
      ? String(ctx.request.body.path).slice(0, 160)
      : undefined;
    const requestUserAgent = typeof ctx.request.body?.userAgent === 'string'
      ? String(ctx.request.body.userAgent).slice(0, 240)
      : undefined;
    const requestLanguage = typeof ctx.request.body?.language === 'string'
      ? String(ctx.request.body.language).slice(0, 40)
      : undefined;
    const requestPlatform = typeof ctx.request.body?.platform === 'string'
      ? String(ctx.request.body.platform).slice(0, 80)
      : undefined;
    const requestVisibilityState = typeof ctx.request.body?.visibilityState === 'string'
      ? String(ctx.request.body.visibilityState).slice(0, 40)
      : undefined;
    const requestSessionId = typeof ctx.request.body?.sessionId === 'string'
      ? String(ctx.request.body.sessionId).slice(0, 64)
      : undefined;
    const receivedAt = Date.now();

    const safeMetrics = metrics.slice(0, 100).map((metric: any) => ({
      name: String(metric?.name ?? 'unknown').slice(0, 120),
      value: Number(metric?.value ?? 0),
      source: String(metric?.source ?? 'unknown').slice(0, 80),
      ts: Number(metric?.ts ?? Date.now()),
      receivedAt,
      url: requestUrl,
      path: requestPath,
      clientSource: requestSource,
      userAgent: requestUserAgent,
      language: requestLanguage,
      platform: requestPlatform,
      visibilityState: requestVisibilityState,
      sessionId: requestSessionId,
    }));

    if (safeMetrics.length > 0) {
      addFrontendMetrics(safeMetrics);

      const hasErrorMetrics = safeMetrics.some((metric: FrontendMetricEntry) => {
        const name = String(metric.name || '').toLowerCase();
        const source = String(metric.source || '').toLowerCase();
        return name.includes('error')
          || source.includes('error')
          || name.includes('unhandledrejection');
      });

      if (hasErrorMetrics) {
        console.warn(`[frontend-metrics] error entries detected count=${safeMetrics.length} first=${safeMetrics[0].name}`);
      } else if (receivedAt - lastFrontendMetricsInfoLogAt >= FRONTEND_METRICS_INFO_LOG_INTERVAL_MS) {
        lastFrontendMetricsInfoLogAt = receivedAt;
        console.log('[Status] Server laeuft stabil...');
      }
    }

    ctx.body = { ok: true, accepted: safeMetrics.length };
  });

  if (true) {
    router.get('/api/admin/setup/status', (ctx: any) => {
      const hasLegacyConfig = !storedAdminAuth && Boolean(adminAuth);
      ctx.body = {
        ok: true,
        needsSetup: !hasConfiguredAdminCredentials(),
        hasLegacyConfig,
        canMigrateLegacy: hasLegacyConfig,
        user: getConfiguredAdminUser(),
        passwordMinLength: ADMIN_PASSWORD_MIN_LENGTH,
      };
    });

    router.post('/api/admin/setup/bootstrap', (ctx: any) => {
      if (hasConfiguredAdminCredentials()) {
        ctx.status = 409;
        ctx.body = { ok: false, error: 'admin auth already configured' };
        return;
      }

      const user = String(ctx.request.body?.user ?? '').trim();
      const password = String(ctx.request.body?.password ?? '');
      const passwordConfirm = String(ctx.request.body?.passwordConfirm ?? '');

      if (!/^[a-zA-Z0-9._-]{3,32}$/.test(user)) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'username must be 3-32 chars: letters, numbers, dot, underscore, dash' };
        return;
      }

      if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
        ctx.status = 400;
        ctx.body = { ok: false, error: `password must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters` };
        return;
      }

      if (password !== passwordConfirm) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'password confirmation does not match' };
        return;
      }

      const now = Date.now();
      storedAdminAuth = {
        user,
        passwordHash: createScryptPasswordHash(password),
        algo: 'scrypt-v1',
        createdAt: now,
        updatedAt: now,
      };

      try {
        saveStoredAdminAuth(dataDir, storedAdminAuth);
      } catch (error: any) {
        storedAdminAuth = null;
        ctx.status = 500;
        ctx.body = { ok: false, error: `failed to persist admin auth store: ${error?.message ?? 'unknown error'}` };
        return;
      }

      if (!persistMasterAdminUserInServerSettings(user)) {
        ctx.status = 500;
        ctx.body = { ok: false, error: 'failed to persist master admin user in server-settings.json' };
        return;
      }

      const session = createAdminSession(user);
      setAdminSessionCookie(ctx, session.id);
      ctx.body = {
        ok: true,
        user: session.user,
        setupComplete: true,
        idleTimeoutMs: ADMIN_SESSION_IDLE_MS,
        remainingMs: ADMIN_SESSION_IDLE_MS,
      };
    });

    router.post('/api/admin/setup/migrate-legacy', (ctx: any) => {
      const hasLegacyConfig = !storedAdminAuth && Boolean(adminAuth);
      if (!hasLegacyConfig) {
        ctx.status = 409;
        ctx.body = { ok: false, error: 'no legacy auth available for migration' };
        return;
      }

      const legacyUser = String(ctx.request.body?.legacyUser ?? '').trim();
      const legacyPassword = String(ctx.request.body?.legacyPassword ?? '');
      const user = String(ctx.request.body?.user ?? '').trim();
      const password = String(ctx.request.body?.password ?? '');
      const passwordConfirm = String(ctx.request.body?.passwordConfirm ?? '');

      if (!verifyAdminCredentials(legacyUser, legacyPassword)) {
        ctx.status = 401;
        ctx.body = { ok: false, error: 'legacy credentials are invalid' };
        return;
      }

      if (!/^[a-zA-Z0-9._-]{3,32}$/.test(user)) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'username must be 3-32 chars: letters, numbers, dot, underscore, dash' };
        return;
      }

      if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
        ctx.status = 400;
        ctx.body = { ok: false, error: `password must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters` };
        return;
      }

      if (password !== passwordConfirm) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'password confirmation does not match' };
        return;
      }

      const now = Date.now();
      storedAdminAuth = {
        user,
        passwordHash: createScryptPasswordHash(password),
        algo: 'scrypt-v1',
        createdAt: now,
        updatedAt: now,
      };

      try {
        saveStoredAdminAuth(dataDir, storedAdminAuth);
      } catch (error: any) {
        storedAdminAuth = null;
        ctx.status = 500;
        ctx.body = { ok: false, error: `failed to persist admin auth store: ${error?.message ?? 'unknown error'}` };
        return;
      }

      const removedLegacyFromSettings = adminAuthSource === 'adminUiAuth'
        ? clearLegacyAdminUiAuthInServerSettings()
        : false;

      adminAuth = null;
      adminAuthSource = 'none';

      if (!persistMasterAdminUserInServerSettings(user)) {
        ctx.status = 500;
        ctx.body = { ok: false, error: 'failed to persist master admin user in server-settings.json' };
        return;
      }

      addAdminLog('console', `Migrated legacy admin auth to secure store for user=${user}`);

      const session = createAdminSession(user);
      setAdminSessionCookie(ctx, session.id);
      ctx.body = {
        ok: true,
        user: session.user,
        migrated: true,
        removedLegacyFromSettings,
        idleTimeoutMs: ADMIN_SESSION_IDLE_MS,
        remainingMs: ADMIN_SESSION_IDLE_MS,
      };
    });

    router.post('/api/admin/session/login', (ctx: any) => {
      const user = String(ctx.request.body?.user ?? '').trim();
      const password = String(ctx.request.body?.password ?? '');

      if (!hasConfiguredAdminCredentials()) {
        ctx.status = 503;
        ctx.body = { ok: false, error: 'admin setup is required before login' };
        return;
      }

      if (!verifyAdminCredentials(user, password)) {
        ctx.status = 401;
        ctx.body = { ok: false, error: 'invalid credentials' };
        return;
      }

      const session = createAdminSession(user);
      setAdminSessionCookie(ctx, session.id);
      ctx.body = {
        ok: true,
        user: session.user,
        idleTimeoutMs: ADMIN_SESSION_IDLE_MS,
        remainingMs: ADMIN_SESSION_IDLE_MS,
      };
    });

    router.get('/api/admin/session/discord/config', (ctx: any) => {
      const oauth = resolveDiscordAdminOauthConfig(settings);
      const enabled = oauth.clientId.length > 0 && oauth.clientSecret.length > 0;
      ctx.body = {
        ok: true,
        enabled,
      };
    });

    router.get('/api/admin/session/discord/start', (ctx: any) => {
      const oauth = resolveDiscordAdminOauthConfig(settings);
      if (!oauth.clientId || !oauth.clientSecret) {
        ctx.redirect('/admin?discord=disabled');
        return;
      }

      cleanupAdminDiscordOauthStates();
      const state = crypto.randomBytes(20).toString('hex');
      adminDiscordOauthStates.set(state, Date.now());

      const redirectUri = oauth.redirectUri || `${ctx.origin}/api/admin/session/discord/callback`;
      const params = new URLSearchParams({
        client_id: oauth.clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: oauth.scope,
        state,
        prompt: 'select_account',
      });

      ctx.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
    });

    router.get('/api/admin/session/discord/callback', async (ctx: any) => {
      const oauth = resolveDiscordAdminOauthConfig(settings);
      if (!oauth.clientId || !oauth.clientSecret) {
        ctx.redirect('/admin?discord=disabled');
        return;
      }

      cleanupAdminDiscordOauthStates();

      const state = String(ctx.query?.state || '').trim();
      const code = String(ctx.query?.code || '').trim();
      if (!state || !code) {
        ctx.redirect('/admin?discord=invalid-callback');
        return;
      }

      const stateCreatedAt = adminDiscordOauthStates.get(state);
      adminDiscordOauthStates.delete(state);
      if (!stateCreatedAt || (Date.now() - stateCreatedAt > ADMIN_DISCORD_OAUTH_STATE_TTL_MS)) {
        ctx.redirect('/admin?discord=invalid-state');
        return;
      }

      const redirectUri = oauth.redirectUri || `${ctx.origin}/api/admin/session/discord/callback`;

      try {
        const tokenBody = new URLSearchParams({
          client_id: oauth.clientId,
          client_secret: oauth.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }).toString();

        const tokenRes = await Axios.post('https://discord.com/api/oauth2/token', tokenBody, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        });

        const accessToken = String(tokenRes?.data?.access_token || '').trim();
        if (!accessToken) {
          ctx.redirect('/admin?discord=token-failed');
          return;
        }

        const meRes = await Axios.get('https://discord.com/api/users/@me', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 10000,
        });

        const discordId = String(meRes?.data?.id || '').trim();
        if (!discordId) {
          ctx.redirect('/admin?discord=user-failed');
          return;
        }

        const parsed = readServerSettingsJson();
        const usersMap = resolveAdminUsersFromSettingsObject(parsed);
        const matched = Object.entries(usersMap).find(([, profile]) => String(profile.discordId || '').trim() === discordId);
        if (!matched) {
          ctx.redirect('/admin?discord=not-authorized');
          return;
        }

        const adminUser = matched[0];
        const session = createAdminSession(adminUser);
        setAdminSessionCookie(ctx, session.id);
        addAdminLog('console', `Discord login succeeded for admin user='${adminUser}'`);
        ctx.redirect('/admin?devUi=1&admin=1');
      } catch (error) {
        console.error('Discord admin login failed:', error);
        ctx.redirect('/admin?discord=oauth-error');
      }
    });

    router.post('/api/admin/session/logout', (ctx: any) => {
      const session = getAdminSessionFromCtx(ctx);
      if (session) {
        adminSessions.delete(session.id);
      }
      clearAdminSessionCookie(ctx);
      ctx.body = { ok: true };
    });

    router.get('/api/admin/session', (ctx: any) => {
      const session = getAdminSessionFromCtx(ctx);
      if (!session) {
        clearAdminSessionCookie(ctx);
        ctx.status = 401;
        ctx.body = { ok: false, authenticated: false, idleTimeoutMs: ADMIN_SESSION_IDLE_MS };
        return;
      }

      const remainingMs = Math.max(0, ADMIN_SESSION_IDLE_MS - (Date.now() - session.lastActivityAt));
      ctx.body = {
        ok: true,
        authenticated: true,
        user: session.user,
        idleTimeoutMs: ADMIN_SESSION_IDLE_MS,
        remainingMs,
      };
    });

    router.post('/api/admin/session/touch', (ctx: any) => {
      const session = getAdminSessionFromCtx(ctx);
      if (!session) {
        clearAdminSessionCookie(ctx);
        ctx.status = 401;
        ctx.body = { ok: false, authenticated: false, idleTimeoutMs: ADMIN_SESSION_IDLE_MS };
        return;
      }

      touchAdminSession(session);
      setAdminSessionCookie(ctx, session.id);
      ctx.body = {
        ok: true,
        authenticated: true,
        user: session.user,
        idleTimeoutMs: ADMIN_SESSION_IDLE_MS,
        remainingMs: ADMIN_SESSION_IDLE_MS,
      };
    });

    router.get('/admin', (ctx: any) => {
      const session = getAdminSessionFromCtx(ctx);
      if (!session) {
        clearAdminSessionCookie(ctx);
        const prefilledAdminUser = getConfiguredAdminUser();
        const externalUrlJson = JSON.stringify(String(ctx.state.externalUrl || ''));
        ctx.type = 'text/html; charset=utf-8';
        ctx.body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <script>window.__SKYMP_API_BASE_URL__ = ${externalUrlJson};</script>
  <title>SkyMP Admin Login</title>
  <style>
    :root {
      --bg: #0b0f15;
      --panel: #121a27;
      --line: #273246;
      --text: #e6edf8;
      --muted: #9cb0ca;
      --brand: #2ec7b8;
      --brand-2: #6fd6cc;
      --danger: #ff7c7c;
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      font-family: "Trebuchet MS", "Segoe UI", Tahoma, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at 10% -20%, rgba(46,199,184,.28) 0%, rgba(46,199,184,0) 36%),
        radial-gradient(circle at 90% -12%, rgba(121,140,255,.2) 0%, rgba(121,140,255,0) 33%),
        linear-gradient(180deg, #0d1119 0%, #0a0f16 60%, #090d13 100%);
      display: grid;
      place-items: center;
      padding: 20px;
    }
    .login-card {
      width: min(420px, 100%);
      border: 1px solid var(--line);
      border-radius: 16px;
      background: rgba(18, 26, 39, 0.92);
      box-shadow: 0 18px 80px rgba(0,0,0,.38);
      overflow: hidden;
    }
    .login-head {
      padding: 18px 20px 12px;
      border-bottom: 1px solid var(--line);
    }
    .login-title { margin: 0; font-size: 22px; color: var(--brand-2); }
    .login-sub { margin: 6px 0 0; color: var(--muted); font-size: 13px; }
    .login-form { padding: 18px 20px 20px; display: grid; gap: 12px; }
    .login-label { display: grid; gap: 6px; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
    .login-input {
      width: 100%;
      border: 1px solid #33435f;
      background: #0d1420;
      color: var(--text);
      border-radius: 10px;
      height: 42px;
      padding: 0 12px;
      font-size: 14px;
      outline: none;
    }
    .login-input:focus { border-color: var(--brand); box-shadow: 0 0 0 2px rgba(46,199,184,.2); }
    .login-btn {
      border: 1px solid rgba(46,199,184,.45);
      background: linear-gradient(180deg, rgba(46,199,184,.3), rgba(46,199,184,.16));
      color: #dcfffb;
      height: 42px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
    }
    .login-btn:disabled { opacity: .65; cursor: wait; }
    .login-btn--discord {
      border-color: rgba(132,153,255,.55);
      background: linear-gradient(180deg, rgba(132,153,255,.28), rgba(132,153,255,.14));
      color: #e7edff;
    }
    .login-btn--discord:disabled {
      opacity: .55;
      cursor: not-allowed;
      filter: grayscale(.35);
    }
    .login-discord-note {
      margin: -4px 0 0;
      font-size: 11px;
      color: var(--muted);
      text-align: center;
      display: none;
    }
    .login-error { min-height: 18px; color: var(--danger); font-size: 13px; }
    .login-note { margin: 0; font-size: 12px; color: var(--muted); line-height: 1.4; }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="login-head">
      <h1 id="login-title" class="login-title">SkyMP Admin Login</h1>
      <p id="login-sub" class="login-sub">Melde dich an, um das Dashboard zu oeffnen.</p>
    </div>
    <form class="login-form" id="login-form">
      <label class="login-label">Benutzername
        <input id="login-user" class="login-input" type="text" autocomplete="username" value="${prefilledAdminUser}" required />
      </label>
      <label class="login-label">Passwort
        <input id="login-password" class="login-input" type="password" autocomplete="current-password" required />
      </label>
      <label class="login-label" id="login-password-confirm-wrap" style="display:none;">Passwort bestaetigen
        <input id="login-password-confirm" class="login-input" type="password" autocomplete="new-password" />
      </label>
      <button id="login-submit" class="login-btn" type="submit">Einloggen</button>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,.1);margin:2px 0;" />
      <button id="login-discord" class="login-btn login-btn--discord" type="button">&#128640; Mit Discord einloggen</button>
      <p id="login-discord-note" class="login-discord-note">Discord OAuth ist noch nicht konfiguriert &mdash; siehe <a href="/docs/docs_admin_discord_oauth" style="color:var(--muted);">Dokumentation</a></p>
      <button id="login-migrate-toggle" class="login-btn" type="button" style="display:none;">Legacy auf sichere Anmeldung migrieren</button>
      <div id="login-error" class="login-error"></div>
      <p class="login-note" id="login-note">Sicherheitsregel: Nach 10 Minuten ohne Mausklick auf dieser Seite wirst du automatisch ausgeloggt.</p>
    </form>
  </div>
  <script>
    const form = document.getElementById('login-form');
    const userInput = document.getElementById('login-user');
    const passInput = document.getElementById('login-password');
    const passConfirmWrap = document.getElementById('login-password-confirm-wrap');
    const passConfirmInput = document.getElementById('login-password-confirm');
    const submitBtn = document.getElementById('login-submit');
    const discordBtn = document.getElementById('login-discord');
    const migrateToggleBtn = document.getElementById('login-migrate-toggle');
    const errorBox = document.getElementById('login-error');
    const loginTitle = document.getElementById('login-title');
    const loginSub = document.getElementById('login-sub');
    const loginNote = document.getElementById('login-note');

    let setupMode = false;
    let migrationMode = false;
    let canMigrateLegacy = false;
    let passwordMinLength = ${ADMIN_PASSWORD_MIN_LENGTH};
    let discordLoginEnabled = false;

    const discordNoteEl = document.getElementById('login-discord-note');
    const syncDiscordButton = () => {
      if (!discordBtn) return;
      const hidden = setupMode || migrationMode;
      discordBtn.style.display = hidden ? 'none' : 'block';
      discordBtn.disabled = !discordLoginEnabled;
      if (discordNoteEl) {
        discordNoteEl.style.display = (!hidden && !discordLoginEnabled) ? 'block' : 'none';
      }
    };

    const showSetupMode = () => {
      setupMode = true;
      if (loginTitle) loginTitle.textContent = 'SkyMP Admin Ersteinrichtung';
      if (loginSub) loginSub.textContent = 'Lege jetzt dein erstes Admin-Konto an.';
      if (submitBtn) submitBtn.textContent = 'Admin erstellen';
      if (passConfirmWrap) passConfirmWrap.style.display = 'grid';
      if (passInput) passInput.setAttribute('autocomplete', 'new-password');
      if (loginNote) loginNote.textContent = 'Das Passwort wird verschluesselt gespeichert (scrypt).';
      syncDiscordButton();
    };

    const showDiscordQueryMessage = () => {
      const q = new URLSearchParams(window.location.search);
      const state = String(q.get('discord') || '');
      if (!state || !errorBox) return;

      if (state === 'not-authorized') {
        errorBox.textContent = 'Discord-Konto ist keinem Admin-Benutzer zugeordnet.';
      } else if (state === 'disabled') {
        errorBox.textContent = 'Discord-Login ist nicht konfiguriert.';
      } else if (state === 'invalid-state' || state === 'invalid-callback') {
        errorBox.textContent = 'Discord-Login ist abgelaufen oder ungueltig. Bitte erneut versuchen.';
      } else {
        errorBox.textContent = 'Discord-Login fehlgeschlagen. Bitte erneut versuchen.';
      }
    };

    const initializeDiscordLogin = async () => {
      try {
        const response = await fetch('/api/admin/session/discord/config', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) return;
        const data = await response.json();
        discordLoginEnabled = Boolean(data?.enabled);
      } catch {
        discordLoginEnabled = false;
      }
      syncDiscordButton();
    };

    const initializeLoginMode = async () => {
      try {
        const response = await fetch('/api/admin/setup/status', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) return;

        const data = await response.json();
        if (typeof data?.passwordMinLength === 'number' && Number.isFinite(data.passwordMinLength)) {
          passwordMinLength = Math.max(8, Math.floor(data.passwordMinLength));
        }
        if (typeof data?.user === 'string' && !userInput.value) {
          userInput.value = data.user;
        }
        if (data?.needsSetup) {
          showSetupMode();
        } else if (data?.canMigrateLegacy) {
          canMigrateLegacy = true;
          if (migrateToggleBtn) {
            migrateToggleBtn.style.display = 'block';
          }
        }
      } catch {
        // ignore setup mode fetch errors
      }
    };

    const setMigrationMode = (enabled) => {
      migrationMode = Boolean(enabled);
      if (!canMigrateLegacy) return;

      if (migrationMode) {
        if (loginTitle) loginTitle.textContent = 'SkyMP Legacy Migration';
        if (loginSub) loginSub.textContent = 'Alte Zugangsdaten bestaetigen und neues sicheres Passwort setzen.';
        if (submitBtn) submitBtn.textContent = 'Migration ausfuehren';
        if (migrateToggleBtn) migrateToggleBtn.textContent = 'Zurueck zum Login';
        if (passConfirmWrap) passConfirmWrap.style.display = 'grid';
        if (passInput) passInput.setAttribute('autocomplete', 'current-password');
        if (loginNote) loginNote.textContent = 'Feld Passwort = altes Passwort, Feld Passwort bestaetigen = neues Passwort. Klartext-Credentials werden danach deaktiviert.';
      } else {
        if (loginTitle) loginTitle.textContent = 'SkyMP Admin Login';
        if (loginSub) loginSub.textContent = 'Melde dich an, um das Dashboard zu oeffnen.';
        if (submitBtn) submitBtn.textContent = 'Einloggen';
        if (migrateToggleBtn) migrateToggleBtn.textContent = 'Legacy auf sichere Anmeldung migrieren';
        if (passConfirmWrap) passConfirmWrap.style.display = 'none';
        if (passInput) passInput.setAttribute('autocomplete', 'current-password');
        if (loginNote) loginNote.textContent = 'Sicherheitsregel: Nach 10 Minuten ohne Mausklick auf dieser Seite wirst du automatisch ausgeloggt.';
      }
      if (errorBox) errorBox.textContent = '';
      syncDiscordButton();
    };

    if (migrateToggleBtn) {
      migrateToggleBtn.addEventListener('click', () => {
        if (setupMode) return;
        setMigrationMode(!migrationMode);
      });
    }

    void initializeLoginMode();
    void initializeDiscordLogin();
    showDiscordQueryMessage();

    if (discordBtn) {
      discordBtn.addEventListener('click', () => {
        if (!discordLoginEnabled) return;
        window.location.href = '/api/admin/session/discord/start';
      });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorBox.textContent = '';
      submitBtn.disabled = true;
      try {
        const payload = {
          user: String(userInput.value || ''),
          password: String(passInput.value || ''),
        };

        if (setupMode || migrationMode) {
          const confirmValue = String(passConfirmInput.value || '');
          const passwordToValidate = migrationMode ? confirmValue : payload.password;
          if (passwordToValidate.length < passwordMinLength) {
            throw new Error('password too short');
          }
          if (setupMode && payload.password !== confirmValue) {
            throw new Error('password confirm mismatch');
          }
        }

        const response = await fetch(
          setupMode
            ? '/api/admin/setup/bootstrap'
            : (migrationMode ? '/api/admin/setup/migrate-legacy' : '/api/admin/session/login'),
          {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(setupMode
            ? { ...payload, passwordConfirm: String(passConfirmInput.value || '') }
            : (migrationMode
              ? {
                legacyUser: payload.user,
                legacyPassword: payload.password,
                user: payload.user,
                password: String(passConfirmInput.value || ''),
                passwordConfirm: String(passConfirmInput.value || ''),
              }
              : payload)),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(text || 'request failed');
        }

        window.location.href = '/admin?devUi=1&admin=1';
      } catch (error) {
        const msg = String(error && error.message ? error.message : '');
        if ((setupMode || migrationMode) && msg.includes('password too short')) {
          errorBox.textContent = 'Passwort ist zu kurz.';
        } else if ((setupMode || migrationMode) && msg.includes('password confirm mismatch')) {
          errorBox.textContent = 'Passwort-Bestaetigung stimmt nicht ueberein.';
        } else if (migrationMode && msg.includes('legacy credentials are invalid')) {
          errorBox.textContent = 'Alte Zugangsdaten sind ungueltig.';
        } else if (setupMode) {
          errorBox.textContent = 'Ersteinrichtung fehlgeschlagen. Eingaben pruefen.';
        } else if (migrationMode) {
          errorBox.textContent = 'Migration fehlgeschlagen. Daten pruefen.';
        } else {
          errorBox.textContent = 'Login fehlgeschlagen. Bitte Zugangsdaten pruefen.';
        }
      } finally {
        submitBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
        return;
      }

      touchAdminSession(session);
      setAdminSessionCookie(ctx, session.id);

      const devUi = String(ctx.query?.devUi ?? '');
      const admin = String(ctx.query?.admin ?? '');
      if (devUi !== '1' || admin !== '1') {
        ctx.redirect('/admin?devUi=1&admin=1');
        return;
      }

      ctx.type = 'text/html; charset=utf-8';
      const externalUrlJson = JSON.stringify(String(ctx.state.externalUrl || ''));
      ctx.body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>SkyMP Admin Dashboard</title>
  <style>html,body{margin:0;height:100%;background:#0b0f15;}</style>
</head>
<body>
  <div style="position:fixed;right:12px;top:10px;z-index:1300;background:rgba(10,16,24,.9);border:1px solid rgba(46,199,184,.45);border-radius:999px;padding:6px 10px;color:#c7fff7;font:600 12px/1.2 'Trebuchet MS','Segoe UI',Tahoma,sans-serif;">
    Auto-Logout in: <span id="admin-session-timer">10:00</span>
    <button id="admin-session-logout" style="margin-left:8px;border:1px solid rgba(255,124,124,.55);background:rgba(255,124,124,.15);color:#ffd8d8;border-radius:999px;padding:2px 8px;cursor:pointer;">Logout</button>
  </div>
  <div id="root"></div>
  <script>
    window.__SKYMP_ADMIN_MODE__ = true;
    window.__SKYMP_API_BASE_URL__ = ${externalUrlJson};
    try {
      window.localStorage.setItem('skymp.dev.loggedIn', '1');
    } catch {}

    (function setupAdminSessionTimer() {
      const timerEl = document.getElementById('admin-session-timer');
      const logoutBtn = document.getElementById('admin-session-logout');
      const idleTimeoutMs = ${ADMIN_SESSION_IDLE_MS};
      let deadlineAt = Date.now() + idleTimeoutMs;
      let touchInFlight = false;
      let lastTouchAt = 0;

      const formatMs = (ms) => {
        const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
      };

      const updateTimer = () => {
        const remaining = deadlineAt - Date.now();
        if (timerEl) timerEl.textContent = formatMs(remaining);
        if (remaining <= 0) {
          window.location.href = '/admin?loggedOut=1';
        }
      };

      const touchSession = async () => {
        const now = Date.now();
        if (touchInFlight || (now - lastTouchAt) < 2000) return;
        touchInFlight = true;
        lastTouchAt = now;

        try {
          const response = await fetch('/api/admin/session/touch', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          });
          if (!response.ok) {
            window.location.href = '/admin?loggedOut=1';
            return;
          }
          const data = await response.json();
          const remainingMs = Number(data?.remainingMs);
          deadlineAt = Date.now() + (Number.isFinite(remainingMs) ? remainingMs : idleTimeoutMs);
        } catch {
          window.location.href = '/admin?loggedOut=1';
        } finally {
          touchInFlight = false;
        }
      };

      const initializeSession = async () => {
        try {
          const response = await fetch('/api/admin/session', {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
          });

          if (!response.ok) {
            window.location.href = '/admin?loggedOut=1';
            return;
          }

          const data = await response.json();
          const remainingMs = Number(data?.remainingMs);
          deadlineAt = Date.now() + (Number.isFinite(remainingMs) ? remainingMs : idleTimeoutMs);
        } catch {
          window.location.href = '/admin?loggedOut=1';
        }
      };

      document.addEventListener('click', () => {
        void touchSession();
      }, true);

      if (logoutBtn) {
        logoutBtn.addEventListener('click', async (event) => {
          event.preventDefault();
          try {
            await fetch('/api/admin/session/logout', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: '{}',
            });
          } catch {}
          window.location.href = '/admin?loggedOut=1';
        });
      }

      setInterval(updateTimer, 1000);
      void initializeSession();
      updateTimer();
    })();
  </script>
  <script src="/build.js?v=${Date.now()}"></script>
</body>
</html>`;
    });

    router.get('/admin/', (ctx: any) => {
      ctx.redirect('/admin');
    });

    router.get('/admin-app', (ctx: any) => {
      ctx.redirect('/admin');
    });

    router.get('/admin-app/', (ctx: any) => {
      ctx.redirect('/admin');
    });

    router.use('/api/admin', async (ctx: any, next: any) => {
      if (ctx.path.startsWith('/api/admin/session/') || ctx.path.startsWith('/api/admin/setup/')) {
        await next();
        return;
      }

      const session = getAdminSessionFromCtx(ctx);
      if (session) {
        ctx.state.adminUser = session.user;
        await next();
        return;
      }

      const basicUser = getValidBasicAdminUser(ctx);
      if (basicUser) {
        ctx.state.adminUser = basicUser;
        await next();
        return;
      }

      ctx.status = 401;
      ctx.body = { ok: false, error: 'unauthorized' };
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

    router.post('/api/admin/server/control', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canConsole')) return;

      const action = String(ctx.request.body?.action ?? '').trim().toLowerCase();
      if (action !== 'stop' && action !== 'restart') {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'invalid action' };
        return;
      }

      const supervisor = getSupervisorSettings(settings);
      const command = action === 'stop'
        ? supervisor.stopCommand
        : supervisor.restartCommand;

      if (!supervisor.enabled || !command) {
        ctx.status = 409;
        ctx.body = {
          ok: false,
          error: 'server control requires a configured supervisor',
        };
        return;
      }

      addAdminLog('console', `Server ${action} requested from admin dashboard via supervisor`);
      ctx.body = { ok: true, action, queued: true, via: 'supervisor' };

      setTimeout(() => {
        try {
          const child = spawn(command, [], {
            cwd: process.cwd(),
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
            shell: true,
            env: process.env,
          });
          child.unref();
        } catch (error: any) {
          console.error(`Failed to execute supervisor ${action} command:`, error);
          addAdminLog('error', `Failed to execute supervisor ${action} command: ${error?.message ?? 'unknown error'}`);
        }
      }, 200);
    });

    router.get('/api/admin/capabilities', (ctx: any) => {
      const { user, role, capabilities } = getAdminContext(settings, ctx);
      ctx.body = {
        user,
        role,
        ...capabilities,
        serverControlAvailable: capabilities.canConsole && isServerControlAvailable(settings),
      };
    });

    router.get('/api/admin/admin-users', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canViewLogs')) return;

      try {
        const parsed = readServerSettingsJson();
        const usersMap = resolveAdminUsersFromSettingsObject(parsed);
        const configuredUser = getConfiguredAdminUser();
        const masterUser = resolveMasterAdminUserFromSettingsObject(parsed, configuredUser);
        if (masterUser && !usersMap[masterUser]) {
          usersMap[masterUser] = { role: 'admin' };
        }

        const currentUser = String(getBasicAuthUser(ctx) || '');
        const totalPermissions = Object.keys(ADMIN_ROLE_DEFAULT_CAPABILITIES.admin).length;
        const entries = Object.entries(usersMap)
          .map(([user, profile]) => {
            const role = normalizeAdminRole(profile.role);
            const capabilities = getAdminCapabilitiesForRole(settings, role);
            const permissionsCount = Object.values(capabilities).filter(Boolean).length;
            return {
              user,
              role,
              discordId: profile.discordId || '',
              permissionsCount,
              permissionsLabel: permissionsCount >= totalPermissions
                ? 'all permissions'
                : `${permissionsCount} permissions`,
              auth: {
                password: user === masterUser,
                discord: Boolean(profile.discordId),
              },
              isCurrentUser: currentUser.length > 0 && user === currentUser,
              isPrimary: user === masterUser,
            };
          })
          .sort((a, b) => {
            if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
            return a.user.localeCompare(b.user, 'en', { sensitivity: 'base' });
          });

        ctx.body = {
          ok: true,
          entries,
          currentUser,
          primaryUser: masterUser,
        };
      } catch (error) {
        ctx.status = 500;
        ctx.body = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    router.post('/api/admin/admin-users', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canConsole')) return;

      const user = String(ctx.request.body?.user ?? '').trim();
      const role = normalizeAdminRole(ctx.request.body?.role);
      const discordId = String(ctx.request.body?.discordId ?? '').trim();

      if (!/^[a-zA-Z0-9._-]{3,32}$/.test(user)) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'username must be 3-32 chars: letters, numbers, dot, underscore, dash' };
        return;
      }

      try {
        const parsed = readServerSettingsJson();
        const usersMap = resolveAdminUsersFromSettingsObject(parsed);
        const masterUser = resolveMasterAdminUserFromSettingsObject(parsed, getConfiguredAdminUser());
        usersMap[user] = {
          role: user === masterUser ? 'admin' : role,
          ...(discordId ? { discordId } : {}),
        };

        applyAdminUsersToSettingsObject(parsed, usersMap);
        writeServerSettingsJson(parsed);

        if (settings.allSettings && typeof settings.allSettings === 'object') {
          (settings.allSettings as any).adminUiUsers = parsed.adminUiUsers;
          (settings.allSettings as any).adminUiRoles = parsed.adminUiRoles;
        }

        const effectiveRole = usersMap[user].role;
        addAdminLog('console', `Updated admin user '${user}' with role=${effectiveRole}`);
        ctx.body = { ok: true, user, role: effectiveRole, discordId };
      } catch (error) {
        ctx.status = 500;
        ctx.body = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    router.delete('/api/admin/admin-users/:user', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canConsole')) return;

      const user = String(ctx.params.user ?? '').trim();
      if (!user) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'user is required' };
        return;
      }

      try {
        const parsed = readServerSettingsJson();
        const masterUser = resolveMasterAdminUserFromSettingsObject(parsed, getConfiguredAdminUser());
        if (user === masterUser) {
          ctx.status = 400;
          ctx.body = { ok: false, error: 'cannot delete primary admin user' };
          return;
        }

        const usersMap = resolveAdminUsersFromSettingsObject(parsed);
        if (!Object.prototype.hasOwnProperty.call(usersMap, user)) {
          ctx.status = 404;
          ctx.body = { ok: false, error: 'admin user not found' };
          return;
        }

        delete usersMap[user];
        applyAdminUsersToSettingsObject(parsed, usersMap);
        writeServerSettingsJson(parsed);

        if (settings.allSettings && typeof settings.allSettings === 'object') {
          (settings.allSettings as any).adminUiUsers = parsed.adminUiUsers;
          (settings.allSettings as any).adminUiRoles = parsed.adminUiRoles;
        }

        addAdminLog('console', `Deleted admin user '${user}'`);
        ctx.body = { ok: true, user };
      } catch (error) {
        ctx.status = 500;
        ctx.body = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    router.post('/api/admin/cfg/server-settings', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canConsole')) return;

      try {
        const parsed = readServerSettingsJson() as Record<string, any>;
        const masterUser = resolveMasterAdminUserFromSettingsObject(parsed, getConfiguredAdminUser());
        const updates = ctx.request.body || {};

        // Validate and apply updates to server-settings.json
        if (typeof updates.serverName === 'string') {
          parsed.serverName = updates.serverName.trim() || 'Skymp Server';
        }
        if (typeof updates.port === 'number' && updates.port > 0 && updates.port < 65536) {
          parsed.port = Math.floor(updates.port);
        }
        if (typeof updates.maxPlayers === 'number' && updates.maxPlayers > 0) {
          parsed.maxPlayers = Math.floor(updates.maxPlayers);
        }
        if (typeof updates.defaultLanguage === 'string') {
          parsed.defaultLanguage = updates.defaultLanguage;
        }

        // Discord OAuth config
        if (typeof updates.adminUiDiscordAuth_clientId === 'string') {
          if (!parsed.adminUiDiscordAuth) {
            parsed.adminUiDiscordAuth = {};
          }
          (parsed.adminUiDiscordAuth as Record<string, any>).clientId = updates.adminUiDiscordAuth_clientId.trim();
        }
        if (typeof updates.adminUiDiscordAuth_clientSecret === 'string') {
          if (!parsed.adminUiDiscordAuth) {
            parsed.adminUiDiscordAuth = {};
          }
          (parsed.adminUiDiscordAuth as Record<string, any>).clientSecret = updates.adminUiDiscordAuth_clientSecret.trim();
        }
        if (typeof updates.adminUiDiscordAuth_redirectUri === 'string') {
          if (!parsed.adminUiDiscordAuth) {
            parsed.adminUiDiscordAuth = {};
          }
          (parsed.adminUiDiscordAuth as Record<string, any>).redirectUri = updates.adminUiDiscordAuth_redirectUri.trim();
        }

        // Ensure master admin is preserved
        if (masterUser) {
          if (!parsed.adminUiUsers) {
            parsed.adminUiUsers = {};
          }
          if (!(parsed.adminUiUsers as Record<string, any>)[masterUser]) {
            (parsed.adminUiUsers as Record<string, any>)[masterUser] = { role: 'admin' };
          }
        }

        // Write back to file
        writeServerSettingsJson(parsed);

        // Update in-memory settings
        if (settings.allSettings && typeof settings.allSettings === 'object') {
          (settings.allSettings as any).serverName = parsed.serverName;
          (settings.allSettings as any).port = parsed.port;
          (settings.allSettings as any).maxPlayers = parsed.maxPlayers;
          (settings.allSettings as any).defaultLanguage = parsed.defaultLanguage;
          (settings.allSettings as any).adminUiDiscordAuth = parsed.adminUiDiscordAuth;
        }

        const { user: adminUser } = getAdminContext(settings, ctx);
        addAdminLog('console', `Updated server settings by admin '${adminUser}'`);

        ctx.body = { ok: true, message: 'Settings updated successfully' };
      } catch (error) {
        ctx.status = 500;
        ctx.body = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    router.post('/api/admin/whitelist/add', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canConsole')) return;

      try {
        const identifier = String(ctx.request.body?.identifier ?? '').trim();
        if (!identifier) {
          ctx.status = 400;
          ctx.body = { ok: false, error: 'identifier is required' };
          return;
        }

        // Parse identifier: "type:value" format
        const colonIndex = identifier.indexOf(':');
        if (colonIndex < 1 || colonIndex >= identifier.length - 1) {
          ctx.status = 400;
          ctx.body = { ok: false, error: 'identifier must be in format "type:value" (e.g., discord:123456)' };
          return;
        }

        const type = identifier.slice(0, colonIndex).toLowerCase().trim();
        const value = identifier.slice(colonIndex + 1).trim();

        if (!value) {
          ctx.status = 400;
          ctx.body = { ok: false, error: 'identifier value cannot be empty' };
          return;
        }

        // Supported types
        const supportedTypes = ['discord', 'steam', 'license', 'licenseea', 'live', 'xblive', 'fal'];
        if (!supportedTypes.includes(type)) {
          ctx.status = 400;
          ctx.body = { ok: false, error: `unsupported identifier type: ${type}. Supported: ${supportedTypes.join(', ')}` };
          return;
        }

        const parsed = readServerSettingsJson() as Record<string, any>;
        const joinAccess = ensureJoinAccessSettingsInObject(parsed) as Record<string, any>;

        // Add to appropriate list based on type
        if (type === 'discord') {
          const approvedDiscordIds = joinAccess.approvedDiscordIds || [];
          if (!approvedDiscordIds.includes(value)) {
            approvedDiscordIds.push(value);
            joinAccess.approvedDiscordIds = approvedDiscordIds;
          }
        } else {
          // All other types go to approvedLicenses
          const approvedLicenses = joinAccess.approvedLicenses || [];
          const entry = `${type}:${value}`;
          if (!approvedLicenses.includes(entry)) {
            approvedLicenses.push(entry);
            joinAccess.approvedLicenses = approvedLicenses;
          }
        }

        writeServerSettingsJson(parsed);

        if (settings.allSettings && typeof settings.allSettings === 'object') {
          (settings.allSettings as any).joinAccess = joinAccess;
        }

        const { user: adminUser } = getAdminContext(settings, ctx);
        addAdminLog('console', `Added whitelist entry '${identifier}' by admin '${adminUser}'`);

        ctx.body = { ok: true, message: 'Whitelist entry added successfully', identifier };
      } catch (error) {
        ctx.status = 500;
        ctx.body = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    router.get('/api/admin/players', (ctx: any) => {
      updatePlayerStatsSnapshot(dataDir);
      const now = Date.now();

      const players = getOnlinePlayerIds().map((userId) => {
        const actorId = safeCall(() => gScampServer.getUserActor(userId), 0);
        const stats = adminPlayerStats.get(userId);
        const sessionPlayMs = stats?.activeSessionStartedAt ? Math.max(0, now - stats.activeSessionStartedAt) : 0;
        const playTimeSec = Math.floor(((stats?.totalPlayMs ?? 0) + sessionPlayMs) / 1000);

        return {
          userId,
          actorId,
          actorName: actorId ? safeCall(() => gScampServer.getActorName(actorId), '') : '',
          ip: safeCall(() => gScampServer.getUserIp(userId), ''),
          pos: actorId ? safeCall(() => gScampServer.getActorPos(actorId), []) : [],
          cellOrWorld: actorId ? safeCall(() => gScampServer.getActorCellOrWorld(actorId), 0) : 0,
          firstJoinedAt: stats?.firstJoinedAt ?? null,
          lastConnectionAt: stats?.lastConnectionAt ?? now,
          playTimeSec,
        };
      });
      ctx.body = players;
    });

    router.get('/api/admin/players/:userId/inventory', (ctx: any) => {
      const userId = Number(ctx.params.userId);
      if (!Number.isFinite(userId)) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'invalid userId' };
        return;
      }

      const actorId = safeCall(() => gScampServer.getUserActor(userId), 0);
      const onlineInventory = actorId
        ? safeCall(() => gScampServer.get(actorId, 'inventory'), null as unknown)
        : null;
      const onlineProfileId = actorId
        ? safeCall(() => Number(gScampServer.get(actorId, 'profileId')), NaN)
        : NaN;

      if (onlineInventory && typeof onlineInventory === 'object') {
        ctx.body = {
          ok: true,
          userId,
          actorId,
          profileId: Number.isFinite(onlineProfileId) ? onlineProfileId : null,
          source: 'online',
          entryCount: getInventoryEntriesCount(onlineInventory),
          inventory: onlineInventory,
        };
        return;
      }

      const requestedProfileId = Number(ctx.query?.profileId);
      const candidateProfileId = Number.isFinite(requestedProfileId)
        ? requestedProfileId
        : (Number.isFinite(onlineProfileId) ? onlineProfileId : userId);

      const offlineSnapshot = getOfflineInventorySnapshot(dataDir, candidateProfileId);
      if (!offlineSnapshot) {
        ctx.status = 404;
        ctx.body = { ok: false, error: 'inventory snapshot not found' };
        return;
      }

      ctx.body = {
        ok: true,
        userId,
        actorId,
        profileId: offlineSnapshot.profileId,
        source: 'offline-file',
        formDesc: offlineSnapshot.formDesc,
        updatedAt: offlineSnapshot.updatedAt,
        filePath: path.relative(process.cwd(), offlineSnapshot.filePath),
        entryCount: getInventoryEntriesCount(offlineSnapshot.inventory),
        inventory: offlineSnapshot.inventory,
      };
    });

    router.post('/api/admin/players/:userId/kick', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canKick')) return;
      const userId = Number(ctx.params.userId);
      if (!Number.isFinite(userId)) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'invalid userId' };
        return;
      }
      const reason = String(ctx.request.body?.reason ?? '').trim();
      const { user: kickAuthor } = getAdminContext(settings, ctx);
      const kickPlayerName = adminPlayerStats.get(userId)?.lastDisplayName || `userId=${userId}`;
      safeCall(() => gScampServer.kick(userId), undefined);
      const reasonSuffix = reason ? ` reason=${reason.slice(0, 80)}` : '';
      addAdminLog('kick', `Kicked userId=${userId}${reasonSuffix}`);
      addAdminHistory({ type: 'kick', playerName: kickPlayerName, userId, reason, author: kickAuthor });
      saveHistory(dataDir);
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
      const durationRaw = Number(ctx.request.body?.durationMinutes);
      const reason = String(ctx.request.body?.reason ?? '').trim();
      const isPermanent = !Number.isFinite(durationRaw) || durationRaw <= 0;
      const durationMinutes = isPermanent ? 0 : Math.min(365 * 24 * 60, Math.floor(durationRaw));
      const expiresAt = isPermanent ? null : Date.now() + durationMinutes * 60 * 1000;
      bannedUsers.set(userId, expiresAt);
      saveBans(dataDir);
      const { user: banAuthor } = getAdminContext(settings, ctx);
      const banPlayerName = adminPlayerStats.get(userId)?.lastDisplayName || `userId=${userId}`;
      safeCall(() => gScampServer.kick(userId), undefined);
      const reasonSuffix = reason ? ` reason=${reason.slice(0, 80)}` : '';
      const durationNote = isPermanent ? ' (permanent)' : ` for ${durationMinutes}m`;
      addAdminLog('ban', `Banned userId=${userId}${durationNote}${reasonSuffix}`);
      addAdminHistory({ type: 'ban', playerName: banPlayerName, userId, reason, author: banAuthor });
      saveHistory(dataDir);
      ctx.body = { ok: true, userId, banned: true, permanent: isPermanent, expiresAt, durationMinutes: isPermanent ? null : durationMinutes };
    });

    router.delete('/api/admin/players/:userId/ban', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canUnban')) return;
      const userId = Number(ctx.params.userId);
      if (!Number.isFinite(userId)) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'invalid userId' };
        return;
      }
      const wasBanned = bannedUsers.delete(userId);
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

    router.post('/api/admin/players/kick-all', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canKick')) return;
      const reason = String(ctx.request.body?.reason ?? '').trim();
      const userIds = getOnlinePlayerIds();

      userIds.forEach((userId) => {
        safeCall(() => gScampServer.kick(userId), undefined);
      });

      const reasonSuffix = reason ? ` reason=${reason.slice(0, 80)}` : '';
      addAdminLog('kick', `Kicked all players count=${userIds.length}${reasonSuffix}`);
      ctx.body = { ok: true, count: userIds.length, userIds };
    });

    router.post('/api/admin/announcement', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canMessage')) return;
      const message = String(ctx.request.body?.message ?? '').trim();
      const reason = String(ctx.request.body?.reason ?? '').trim();
      if (!message) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'message is required' };
        return;
      }

      const userIds = getOnlinePlayerIds();
      userIds.forEach((userId) => {
        safeCall(() => gScampServer.sendChatMessage?.(userId, message), undefined);
        safeCall(() => gScampServer.sendMessage?.(userId, message), undefined);
      });

      const reasonSuffix = reason ? ` reason=${reason.slice(0, 80)}` : '';
      addAdminLog('console', `Announcement to ${userIds.length} players: ${message.slice(0, 120)}${reasonSuffix}`);
      ctx.body = { ok: true, count: userIds.length, userIds };
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
      const { user: muteAuthor } = getAdminContext(settings, ctx);
      const mutePlayerName = adminPlayerStats.get(userId)?.lastDisplayName || `userId=${userId}`;
      const reasonSuffix = reason ? ` reason=${reason.slice(0, 80)}` : '';
      addAdminLog('mute', `Muted userId=${userId} for ${durationMinutes}m${reasonSuffix}`);
      addAdminHistory({ type: 'mute', playerName: mutePlayerName, userId, reason, author: muteAuthor });
      saveHistory(dataDir);
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
      cleanupExpiredBans();
      const now = Date.now();
      ctx.body = Array.from(bannedUsers.entries()).map(([userId, expiresAt]) => ({
        userId,
        permanent: expiresAt === null,
        expiresAt: expiresAt ?? null,
        remainingSec: expiresAt !== null ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : null,
      }));
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

    router.get('/api/admin/resources', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canViewLogs')) return;

      const query = String(ctx.query?.query ?? '').trim().toLowerCase();
      const kindFilter = String(ctx.query?.kind ?? '').trim().toLowerCase();
      const limitRaw = Number(ctx.query?.limit);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), 2000)
        : 500;

      let entries = listAdminResources(settings, dataDir);

      if (kindFilter === 'mod' || kindFilter === 'script') {
        entries = entries.filter((entry) => entry.kind === kindFilter);
      }

      if (query.length > 0) {
        entries = entries.filter((entry) => {
          return entry.name.toLowerCase().includes(query)
            || entry.path.toLowerCase().includes(query)
            || entry.kind.toLowerCase().includes(query);
        });
      }

      ctx.body = {
        total: entries.length,
        entries: entries.slice(0, limit),
      };
    });

    router.get('/api/admin/cfg/server-settings', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canViewLogs')) return;

      try {
        const parsed = readServerSettingsJson();
        const localeRouting = ensureLocaleRoutingSettingsInObject(parsed);
        const joinAccess = ensureJoinAccessSettingsInObject(parsed);
        const discordBot = ensureDiscordBotSettingsInObject(parsed);
        const supervisor = ensureSupervisorSettingsInObject(parsed);

        ctx.body = {
          ok: true,
          path: getServerSettingsPath(),
          localeRouting,
          joinAccess,
          discordBot,
          supervisor,
          json: JSON.stringify(parsed, null, 2),
        };
      } catch (error) {
        ctx.status = 500;
        ctx.body = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    router.post('/api/admin/cfg/server-settings', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canConsole')) return;

      const jsonRaw = String(ctx.request.body?.json ?? '').trim();
      if (!jsonRaw) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'json payload is required' };
        return;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(jsonRaw) as Record<string, unknown>;
      } catch (error) {
        ctx.status = 400;
        ctx.body = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
        return;
      }

      const localeRouting = ensureLocaleRoutingSettingsInObject(parsed);
      const joinAccess = ensureJoinAccessSettingsInObject(parsed);
      const discordBot = ensureDiscordBotSettingsInObject(parsed);
      const supervisor = ensureSupervisorSettingsInObject(parsed);

      try {
        writeServerSettingsJson(parsed);
        addAdminLog('console', `Updated server-settings.json (locale=${localeRouting.defaultLanguage}, joinMode=${joinAccess.mode}, discordBot=${discordBot.enabled ? 'on' : 'off'}, supervisor=${supervisor.enabled ? 'on' : 'off'})`);
      } catch (error) {
        ctx.status = 500;
        ctx.body = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
        return;
      }

      ctx.body = {
        ok: true,
        restartRequired: true,
        localeRouting,
        joinAccess,
        supervisor,
        discordBot: {
          enabled: discordBot.enabled,
          guildId: discordBot.guildId,
          warningsChannelId: discordBot.warningsChannelId,
          hasToken: discordBot.token.trim().length > 0,
        },
      };
    });

    router.get('/api/admin/locale/resolve', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canViewLogs')) return;

      const countryCode = String(ctx.query?.countryCode ?? '').trim();

      try {
        const parsed = readServerSettingsJson();
        const localeRouting = ensureLocaleRoutingSettingsInObject(parsed);
        const language = resolveLanguageByCountryCode(localeRouting, countryCode);
        ctx.body = {
          ok: true,
          countryCode: countryCode.toUpperCase(),
          language,
          defaultLanguage: localeRouting.defaultLanguage,
        };
      } catch (error) {
        ctx.status = 500;
        ctx.body = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
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
        ? Math.min(Math.floor(limitRaw), Math.max(MAX_ADMIN_LOG, MAX_SERVER_LOG))
        : 100;

      const levelRaw = String(ctx.query?.level ?? '').trim().toLowerCase();
      const levelFilter: ServerLogLevel | null = (
        levelRaw === 'info' || levelRaw === 'error'
      ) ? levelRaw : null;

      const beforeTsRaw = Number(ctx.query?.beforeTs);
      const beforeTs = Number.isFinite(beforeTsRaw) ? beforeTsRaw : null;

      const sinceMinutesRaw = Number(ctx.query?.sinceMinutes);
      const sinceMinutes = Number.isFinite(sinceMinutesRaw) && sinceMinutesRaw > 0
        ? sinceMinutesRaw
        : null;

      const sinceTs = sinceMinutes === null ? null : Date.now() - sinceMinutes * 60 * 1000;

      const combinedEntries = [...adminLog, ...serverLog];

      const entriesByType = typeFilter
        ? combinedEntries.filter((e) => e.type === typeFilter)
        : combinedEntries;

      const entriesByLevel = levelFilter === null
        ? entriesByType
        : entriesByType.filter((entry) => 'level' in entry && entry.level === levelFilter);

      const entriesBySince = sinceTs === null
        ? entriesByLevel
        : entriesByLevel.filter((e) => e.ts >= sinceTs);

      const entriesByCursor = beforeTs === null
        ? entriesBySince
        : entriesBySince.filter((e) => e.ts < beforeTs);

      ctx.body = entriesByCursor
        .slice()
        .sort((left, right) => right.ts - left.ts)
        .slice(0, limit);
    });

    router.get('/api/admin/player-drops', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canViewLogs')) return;
      const hoursRaw = Number(ctx.query?.hours);
      const hours = Number.isFinite(hoursRaw) && hoursRaw > 0 ? Math.min(hoursRaw, 24 * 30) : 168;
      const crashLimitRaw = Number(ctx.query?.crashLimit);
      const crashLimit = Number.isFinite(crashLimitRaw) && crashLimitRaw > 0 ? Math.min(Math.floor(crashLimitRaw), 500) : 50;
      const sortMode = (ctx.query?.sort as string) === 'alphabetical' ? 'alphabetical' : 'count';

      const since = Date.now() - hours * 60 * 60 * 1000;
      const periodStart = Math.min(since, processStartedAt);

      const windowDrops = playerDrops.filter((d) => d.ts >= since);
      const expected = windowDrops.filter((d) => d.type === 'expected');
      const unexpected = windowDrops.filter((d) => d.type === 'unexpected');

      // Resource kicks: drops with a reason starting with 'resource:'
      const resourceKickMap = new Map<string, number>();
      windowDrops.filter((d) => d.reason?.startsWith('resource:')).forEach((d) => {
        const res = d.reason!.slice('resource:'.length).trim() || 'unknown';
        resourceKickMap.set(res, (resourceKickMap.get(res) ?? 0) + 1);
      });
      const resourceKicks = Array.from(resourceKickMap.entries())
        .map(([resource, count]) => ({ resource, count }))
        .sort((a, b) => b.count - a.count);

      // Crash reasons: from unexpected drops with a reason
      const crashMap = new Map<string, number>();
      unexpected.filter((d) => d.reason).forEach((d) => {
        const reason = d.reason!.slice(0, 120);
        crashMap.set(reason, (crashMap.get(reason) ?? 0) + 1);
      });
      let crashReasons = Array.from(crashMap.entries()).map(([reason, count]) => ({ reason, count }));
      if (sortMode === 'alphabetical') {
        crashReasons.sort((a, b) => a.reason.localeCompare(b.reason));
      } else {
        crashReasons.sort((a, b) => b.count - a.count);
      }
      crashReasons = crashReasons.slice(0, crashLimit);

      const windowEnvChanges = environmentChanges.filter((e) => e.ts >= since);

      ctx.body = {
        expected,
        unexpected,
        periodStart,
        periodEnd: Date.now(),
        resourceKicks,
        environmentChanges: windowEnvChanges,
        crashReasons,
      };
    });

    router.get('/api/admin/history', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canViewLogs')) return;
      const typeFilter = (ctx.query?.type as string | undefined) || '';
      const searchMode = (ctx.query?.searchMode as string | undefined) || 'actionId';
      const searchQuery = String(ctx.query?.search ?? '').trim().toLowerCase();
      const authorFilter = String(ctx.query?.author ?? '').trim().toLowerCase();
      const limitRaw = Number(ctx.query?.limit);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), MAX_ADMIN_HISTORY) : 200;

      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const totalWarns = adminHistory.filter((e) => e.type === 'warn').length;
      const totalBans = adminHistory.filter((e) => e.type === 'ban').length;
      const newWarns7d = adminHistory.filter((e) => e.type === 'warn' && e.ts >= sevenDaysAgo).length;
      const newBans7d = adminHistory.filter((e) => e.type === 'ban' && e.ts >= sevenDaysAgo).length;
      const admins = [...new Set(adminHistory.map((e) => e.author))].filter(Boolean);

      let entries = adminHistory.slice();
      if (typeFilter && ['warn', 'ban', 'kick', 'mute'].includes(typeFilter)) {
        entries = entries.filter((e) => e.type === typeFilter);
      }
      if (searchQuery) {
        if (searchMode === 'actionId') {
          entries = entries.filter((e) => e.id.toLowerCase().includes(searchQuery));
        } else if (searchMode === 'player') {
          entries = entries.filter((e) => e.playerName.toLowerCase().includes(searchQuery) || String(e.userId).includes(searchQuery));
        } else if (searchMode === 'reason') {
          entries = entries.filter((e) => e.reason.toLowerCase().includes(searchQuery));
        }
      }
      if (authorFilter && authorFilter !== 'any') {
        entries = entries.filter((e) => e.author.toLowerCase() === authorFilter);
      }

      entries = entries.slice().sort((a, b) => b.ts - a.ts).slice(0, limit);

      ctx.body = { entries, totalWarns, newWarns7d, totalBans, newBans7d, admins };
    });

    router.post('/api/admin/menu-debug', (ctx: any) => {
      const { user } = getAdminContext(settings, ctx);
      appendAdminMenuDebugLog(dataDir, user, ctx.request.body ?? {});
      const logPath = getAdminMenuDebugLogPath(dataDir);
      ctx.body = {
        ok: true,
        path: path.relative(process.cwd(), logPath),
      };
    });

    router.get('/api/admin/menu-debug', (ctx: any) => {
      const logPath = getAdminMenuDebugLogPath(dataDir);
      const exists = fs.existsSync(logPath);
      const size = exists ? safeCall(() => fs.statSync(logPath).size, 0) : 0;
      ctx.body = {
        ok: true,
        path: path.relative(process.cwd(), logPath),
        exists,
        size,
      };
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

    router.get('/api/admin/client-runtime-events', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canViewLogs')) return;

      const sourceFilter = String(ctx.query?.source ?? '').trim().toLowerCase();
      const eventFilter = String(ctx.query?.event ?? '').trim().toLowerCase();
      const levelRaw = String(ctx.query?.level ?? '').trim().toLowerCase();
      const levelFilter = (levelRaw === 'info' || levelRaw === 'warn' || levelRaw === 'error')
        ? levelRaw
        : null;
      const userIdRaw = Number(ctx.query?.userId);
      const userIdFilter = Number.isFinite(userIdRaw) ? Math.floor(userIdRaw) : null;
      const limitRaw = Number(ctx.query?.limit);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), 200)
        : 50;

      const filtered = clientRuntimeEvents.filter((entry) => {
        if (sourceFilter && entry.source.toLowerCase() !== sourceFilter) return false;
        if (eventFilter && !entry.event.toLowerCase().includes(eventFilter)) return false;
        if (levelFilter && entry.level !== levelFilter) return false;
        if (userIdFilter !== null && entry.userId !== userIdFilter) return false;
        return true;
      });

      const sliceFrom = Math.max(filtered.length - limit, 0);
      ctx.body = {
        summary: summarizeClientRuntimeEvents(filtered),
        entries: filtered.slice(sliceFrom).reverse(),
      };
    });

    router.get('/api/admin/respawn-status', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canManageRespawn')) return;
      ctx.body = syncRespawnState();
    });

    router.post('/api/admin/revive', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canManageRespawn')) return;

      const userId = Number(ctx.request.body?.userId);
      const reason = String(ctx.request.body?.reason ?? '').trim();
      if (!Number.isFinite(userId)) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'invalid userId' };
        return;
      }

      const safeUserId = Math.floor(userId);
      const actorId = safeCall(() => gScampServer.getUserActor(safeUserId), 0);
      if (!actorId) {
        ctx.status = 404;
        ctx.body = { ok: false, error: 'actor not found' };
        return;
      }

      const actorName = safeCall(() => gScampServer.getActorName(actorId), '') || `userId=${safeUserId}`;

      setActorProperty(actorId, 'isDead', false);
      setActorProperty(actorId, 'canRespawn', true);
      trackedRespawnStates.set(safeUserId, {
        actorName,
        isDead: false,
        canRespawn: true,
        downedAt: null,
      });

      addRevivalEvent({
        ts: Date.now(),
        type: 'revived',
        userId: safeUserId,
        actorName,
        details: reason || 'Manual revival from admin dashboard',
      });
      addAdminLog('console', `Revived userId=${safeUserId}${reason ? ` reason=${reason.slice(0, 80)}` : ''}`);

      ctx.body = { ok: true, userId: safeUserId, actorId };
    });

    router.get('/api/admin/events', (ctx: any) => {
      if (!ensureAdminCapability(settings, ctx, 'canViewLogs')) return;

      syncRespawnState();
      const typeFilter = String(ctx.query?.type ?? '').trim().toLowerCase() as '' | RevivalEventType;
      const limitRaw = Number(ctx.query?.limit);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), 200)
        : 100;

      const filtered = revivalEvents.filter((entry) => !typeFilter || entry.type === typeFilter);
      const sliceFrom = Math.max(filtered.length - limit, 0);
      ctx.body = filtered.slice(sliceFrom).reverse();
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
  app.use(serve("ui"));
  app.use(serve("data"));
  return app;
};

export const setServer = (scampServer: any) => {
  gScampServer = scampServer;
};

export const pushClientRuntimeEvents = (entries: Array<{
  userId: number;
  ip?: string;
  source: string;
  sessionId?: string;
  event: string;
  level: 'info' | 'warn' | 'error';
  ts: number;
  receivedAt: number;
  details?: string;
}>): void => {
  const safeEntries = entries.slice(0, 100).map((entry) => ({
    userId: Number.isFinite(entry.userId) ? Math.floor(entry.userId) : 0,
    ip: typeof entry.ip === 'string' ? entry.ip.slice(0, 80) : undefined,
    source: String(entry.source || 'unknown').slice(0, 80),
    sessionId: typeof entry.sessionId === 'string' ? entry.sessionId.slice(0, 64) : undefined,
    event: String(entry.event || 'unknown').slice(0, 120),
    level: entry.level === 'error' || entry.level === 'warn' || entry.level === 'info'
      ? entry.level
      : 'info',
    ts: Number.isFinite(entry.ts) ? entry.ts : Date.now(),
    receivedAt: Number.isFinite(entry.receivedAt) ? entry.receivedAt : Date.now(),
    details: typeof entry.details === 'string' ? entry.details.slice(0, 500) : undefined,
  }));

  if (safeEntries.length > 0) {
    addClientRuntimeEvents(safeEntries);
  }
};

export const pushServerLogChunk = (level: ServerLogLevel, chunk: string): void => {
  pushServerLogChunkInternal(level, chunk);
};

export const pushPlayerDrop = (entry: { userId: number; playerName: string; type: 'expected' | 'unexpected'; reason?: string }): void => {
  addPlayerDrop(entry);
};

export const pushEnvironmentChange = (type: string, description: string): void => {
  addEnvironmentChange(type, description);
};

export const main = (settings: Settings): void => {
  metricsAuthParse(settings);
  adminAuthParse(settings);
  const devServerPort = 1234;

  const uiListenHost = (settings.allSettings.uiListenHost as (string | undefined)) || "0.0.0.0";
  const configuredUiPort = Number(settings.allSettings.uiPort);
  const uiPort = Number.isFinite(configuredUiPort) && configuredUiPort > 0
    ? Math.floor(configuredUiPort)
    : settings.port;

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
        // Load koa-proxy only when dev server proxy mode is active.
        const proxy = require("koa-proxy");
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
