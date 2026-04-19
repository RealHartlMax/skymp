const Koa = require("koa");
const serve = require("koa-static");
const Router = require("koa-router");
const auth = require("koa-basic-auth");
import * as koaBody from "koa-body";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { Settings } from "./settings";
import Axios from "axios";
import { AddressInfo } from "net";
import { register, getAggregatedMetrics, rpcCallsCounter, rpcDurationHistogram } from "./systems/metricsSystem";

let gScampServer: any = null;

let metricsAuth: { user: string; password: string } | null = null;
let adminAuth: { user: string; password: string } | null = null;
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

const frontendMetrics: FrontendMetricEntry[] = [];
const MAX_FRONTEND_METRICS = 1000;
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
  loadModerationState(dataDir);

  const app = new Koa();
  app.use(koaBody.default({ multipart: true }));

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
      console.log(`[frontend-metrics] count=${safeMetrics.length} first=${safeMetrics[0].name}`);
    }

    ctx.body = { ok: true, accepted: safeMetrics.length };
  });

  if (adminAuth) {
    router.post('/api/admin/session/login', (ctx: any) => {
      const user = String(ctx.request.body?.user ?? '').trim();
      const password = String(ctx.request.body?.password ?? '');
      if (!adminAuth || user !== adminAuth.user || password !== adminAuth.password) {
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
        ctx.type = 'text/html; charset=utf-8';
        ctx.body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
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
    .login-error { min-height: 18px; color: var(--danger); font-size: 13px; }
    .login-note { margin: 0; font-size: 12px; color: var(--muted); line-height: 1.4; }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="login-head">
      <h1 class="login-title">SkyMP Admin Login</h1>
      <p class="login-sub">Melde dich an, um das Dashboard zu oeffnen.</p>
    </div>
    <form class="login-form" id="login-form">
      <label class="login-label">Benutzername
        <input id="login-user" class="login-input" type="text" autocomplete="username" value="${adminAuth.user}" required />
      </label>
      <label class="login-label">Passwort
        <input id="login-password" class="login-input" type="password" autocomplete="current-password" required />
      </label>
      <button id="login-submit" class="login-btn" type="submit">Einloggen</button>
      <div id="login-error" class="login-error"></div>
      <p class="login-note">Sicherheitsregel: Nach 10 Minuten ohne Mausklick auf dieser Seite wirst du automatisch ausgeloggt.</p>
    </form>
  </div>
  <script>
    const form = document.getElementById('login-form');
    const userInput = document.getElementById('login-user');
    const passInput = document.getElementById('login-password');
    const submitBtn = document.getElementById('login-submit');
    const errorBox = document.getElementById('login-error');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorBox.textContent = '';
      submitBtn.disabled = true;
      try {
        const response = await fetch('/api/admin/session/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            user: String(userInput.value || ''),
            password: String(passInput.value || ''),
          }),
        });

        if (!response.ok) {
          throw new Error('invalid credentials');
        }

        window.location.href = '/admin?devUi=1&admin=1';
      } catch {
        errorBox.textContent = 'Login fehlgeschlagen. Bitte Zugangsdaten pruefen.';
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
    Session: <span id="admin-session-timer">10:00</span>
    <button id="admin-session-logout" style="margin-left:8px;border:1px solid rgba(255,124,124,.55);background:rgba(255,124,124,.15);color:#ffd8d8;border-radius:999px;padding:2px 8px;cursor:pointer;">Logout</button>
  </div>
  <div id="root"></div>
  <script>
    window.__SKYMP_ADMIN_MODE__ = true;
    try {
      window.localStorage.setItem('skymp.dev.loggedIn', '1');
    } catch {}

    (function setupAdminSessionTimer() {
      const timerEl = document.getElementById('admin-session-timer');
      const logoutBtn = document.getElementById('admin-session-logout');
      const idleTimeoutMs = ${ADMIN_SESSION_IDLE_MS};
      let deadlineAt = Date.now() + idleTimeoutMs;

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
      if (ctx.path.startsWith('/api/admin/session/')) {
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
      const reason = String(ctx.request.body?.reason ?? '').trim();
      safeCall(() => gScampServer.kick(userId), undefined);
      const reasonSuffix = reason ? ` reason=${reason.slice(0, 80)}` : '';
      addAdminLog('kick', `Kicked userId=${userId}${reasonSuffix}`);
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
      safeCall(() => gScampServer.kick(userId), undefined);
      const reasonSuffix = reason ? ` reason=${reason.slice(0, 80)}` : '';
      const durationNote = isPermanent ? ' (permanent)' : ` for ${durationMinutes}m`;
      addAdminLog('ban', `Banned userId=${userId}${durationNote}${reasonSuffix}`);
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

        ctx.body = {
          ok: true,
          path: getServerSettingsPath(),
          localeRouting,
          joinAccess,
          discordBot,
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

      try {
        writeServerSettingsJson(parsed);
        addAdminLog('console', `Updated server-settings.json (locale=${localeRouting.defaultLanguage}, joinMode=${joinAccess.mode}, discordBot=${discordBot.enabled ? 'on' : 'off'})`);
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

export const main = (settings: Settings): void => {
  metricsAuthParse(settings);
  adminAuthParse(settings);
  const devServerPort = 1234;

  const uiListenHost = settings.allSettings.uiListenHost as (string | undefined);
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
