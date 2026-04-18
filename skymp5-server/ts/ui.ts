const Koa = require("koa");
const serve = require("koa-static");
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
  defaultLanguage: 'de',
  countryCodeToLanguage: {
    DE: 'de',
    AT: 'de',
    CH: 'de',
    US: 'en',
    GB: 'en',
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
  <title>SkyMP Control Panel</title>
  <style>
    :root {
      --bg: #0b0f15;
      --bg-alt: #121822;
      --surface: #181f2b;
      --surface-soft: #20293a;
      --line: #2f3b50;
      --text: #e6ebf4;
      --muted: #95a3bb;
      --brand: #27c1b5;
      --brand-soft: rgba(39,193,181,.17);
      --warn: #ff6d62;
      --warn-soft: rgba(255,109,98,.16);
      --gold: #f4c86b;
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      color: var(--text);
      background:
        radial-gradient(circle at 8% -18%, rgba(39,193,181,.2) 0%, rgba(39,193,181,0) 35%),
        radial-gradient(circle at 90% -10%, rgba(98,120,255,.18) 0%, rgba(98,120,255,0) 30%),
        linear-gradient(180deg, #0c1017, #0b1018 35%, #0b0f15);
      font-family: "Trebuchet MS", "Segoe UI", Tahoma, sans-serif;
    }
    .topbar {
      height: 56px;
      border-bottom: 1px solid var(--line);
      background: rgba(17,23,33,.88);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      position: sticky;
      top: 0;
      z-index: 10;
      backdrop-filter: blur(8px);
    }
    .brand { font-size: 31px; letter-spacing: .3px; color: var(--brand); font-weight: 700; }
    .brand small { font-size: 13px; color: var(--muted); margin-left: 8px; font-weight: 600; }
    .main-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-left: 16px; }
    .main-tab {
      border: 1px solid transparent;
      background: transparent;
      color: var(--muted);
      border-radius: 7px;
      padding: 6px 10px;
      cursor: pointer;
      font-family: inherit;
      font-size: 13px;
    }
    .main-tab:hover { color: var(--text); }
    .main-tab.active { background: var(--brand-soft); color: #8ef7ef; border-color: rgba(39,193,181,.35); }
    .meta { color: var(--muted); font-size: 12px; }
    .layout {
      min-height: calc(100vh - 56px);
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr) 240px;
      gap: 12px;
      padding: 12px;
    }
    .pane {
      background: linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,0)), var(--surface);
      border: 1px solid var(--line);
      border-radius: 12px;
    }
    .left-pane { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
    .section-title { font-size: 15px; font-weight: 700; letter-spacing: .4px; }
    .quick-links { display: flex; flex-direction: column; gap: 6px; }
    .quick-link {
      background: transparent;
      border: 1px solid transparent;
      border-radius: 8px;
      color: var(--muted);
      text-align: left;
      padding: 8px 10px;
      cursor: pointer;
      font-family: inherit;
      font-size: 13px;
    }
    .quick-link.active { background: rgba(255,255,255,.05); border-color: var(--line); color: var(--text); }
    .status-box { background: var(--bg-alt); border: 1px solid var(--line); border-radius: 10px; padding: 10px; }
    .status-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; color: var(--muted); }
    .status-row:last-child { margin-bottom: 0; }
    .status-pill { color: #8ef7ef; background: var(--brand-soft); border: 1px solid rgba(39,193,181,.3); border-radius: 999px; padding: 0 8px; font-size: 11px; }
    .status-note { margin-top: 8px; font-size: 12px; color: var(--gold); }
    .center-pane { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
    .cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .card {
      background: var(--bg-alt);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px;
      min-height: 74px;
    }
    .k { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
    .v { margin-top: 8px; font-size: 22px; font-weight: 700; }
    .v--brand { color: #8ef7ef; }
    .panel { display: none; }
    .panel.active { display: block; }
    .block {
      background: var(--bg-alt);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px;
    }
    .search-row { display: flex; gap: 8px; margin-bottom: 8px; }
    .search-input, .console-input {
      width: 100%;
      background: #111722;
      border: 1px solid var(--line);
      color: var(--text);
      border-radius: 8px;
      padding: 8px 10px;
      font-family: inherit;
      font-size: 13px;
    }
    .search-input:focus, .console-input:focus { outline: none; border-color: rgba(39,193,181,.6); }
    .tbl-wrap { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th {
      background: #151d2a;
      color: var(--muted);
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: .05em;
      font-weight: 600;
      text-align: left;
      padding: 8px 10px;
      border-bottom: 1px solid var(--line);
    }
    td { padding: 9px 10px; border-bottom: 1px solid rgba(47,59,80,.55); }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: rgba(255,255,255,.03); }
    td.pos { font-family: Consolas, "Courier New", monospace; color: var(--muted); font-size: 12px; }
    .btn {
      border-radius: 7px;
      font-size: 12px;
      padding: 5px 10px;
      cursor: pointer;
      border: 1px solid var(--line);
      background: #131a27;
      color: var(--text);
      font-family: inherit;
    }
    .btn:hover { background: #172134; }
    .btn-kick { color: #ff9e97; border-color: rgba(255,109,98,.45); }
    .btn-kick:hover { background: var(--warn-soft); }
    .btn-ban { color: #ffd08d; border-color: rgba(244,200,107,.45); margin-left: 4px; }
    .btn-ban:hover { background: rgba(244,200,107,.15); }
    .btn-send { color: #8ef7ef; border-color: rgba(39,193,181,.45); min-width: 110px; }
    .btn-send:hover { background: var(--brand-soft); }
    .console-out {
      height: 390px;
      overflow-y: auto;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #0f1622;
      padding: 10px;
      margin-bottom: 8px;
      font-family: Consolas, "Courier New", monospace;
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .console-row { display: flex; gap: 8px; }
    .log-filters { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
    .log-filter {
      background: #121927;
      border: 1px solid var(--line);
      color: var(--muted);
      border-radius: 7px;
      padding: 5px 9px;
      font-size: 12px;
      cursor: pointer;
    }
    .log-filter.active { border-color: rgba(39,193,181,.5); color: #8ef7ef; }
    .log-list { display: flex; flex-direction: column; gap: 6px; max-height: 480px; overflow-y: auto; }
    .log-entry { display: flex; gap: 10px; background: #111825; border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; font-size: 12px; }
    .log-ts { color: var(--muted); min-width: 70px; }
    .log-type { text-transform: uppercase; font-weight: 700; font-size: 10px; border-radius: 4px; padding: 2px 5px; }
    .log-type--kick { color: #ff9e97; background: var(--warn-soft); }
    .log-type--ban { color: #ffd08d; background: rgba(244,200,107,.15); }
    .log-type--console { color: #8ef7ef; background: var(--brand-soft); }
    .no-data { color: var(--muted); font-size: 13px; padding: 14px 0; }
    .status-bar { color: var(--muted); font-size: 12px; margin-top: 8px; min-height: 18px; }
    .coming-soon { color: var(--muted); font-size: 13px; line-height: 1.7; }
    .right-pane { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
    .online-box { text-align: center; background: var(--bg-alt); border: 1px solid var(--line); border-radius: 10px; padding: 10px; }
    .online-box .value { font-size: 34px; font-weight: 700; }
    .mini-list { background: var(--bg-alt); border: 1px solid var(--line); border-radius: 10px; padding: 8px; }
    .mini-item { font-size: 12px; color: var(--text); padding: 7px 6px; border-bottom: 1px solid rgba(47,59,80,.45); }
    .mini-item:last-child { border-bottom: none; }
    .mini-item small { color: var(--muted); display: block; margin-top: 2px; }
    @media (max-width: 1220px) {
      .layout { grid-template-columns: 210px minmax(0,1fr); }
      .right-pane { grid-column: 1 / -1; }
      .cards { grid-template-columns: repeat(2, minmax(0,1fr)); }
    }
    @media (max-width: 860px) {
      .layout { grid-template-columns: 1fr; }
      .cards { grid-template-columns: 1fr; }
      .topbar { height: auto; padding: 10px 12px; align-items: flex-start; gap: 10px; flex-direction: column; }
      .main-tabs { margin-left: 0; }
    }
  </style>
</head>
<body>
  <div class="topbar">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <div class="brand" id="title">SkyMP Admin</div>
      <div class="main-tabs">
        <button class="main-tab active tab" data-tab="players" id="tabPlayers"></button>
        <button class="main-tab tab" data-tab="console" id="tabConsole"></button>
        <button class="main-tab tab" data-tab="logs" id="tabLogs"></button>
        <button class="main-tab tab" data-tab="resources" id="tabResources"></button>
        <button class="main-tab tab" data-tab="cfg" id="tabCfg"></button>
      </div>
    </div>
    <div class="meta" id="updatedAt"></div>
  </div>

  <div class="layout">
    <aside class="pane left-pane">
      <div class="section-title" id="leftPanelTitle"></div>
      <div class="quick-links">
        <button class="quick-link tab active" data-tab="players" id="quickPlayers"></button>
        <button class="quick-link tab" data-tab="console" id="quickConsole"></button>
        <button class="quick-link tab" data-tab="logs" id="quickLogs"></button>
        <button class="quick-link tab" data-tab="resources" id="quickResources"></button>
        <button class="quick-link tab" data-tab="cfg" id="quickCfg"></button>
      </div>
      <div class="status-box">
        <div class="status-row"><span id="kOnline"></span><span class="status-pill" id="onlineBadge">-</span></div>
        <div class="status-row"><span id="kUptime"></span><span id="lsUptime">-</span></div>
        <div class="status-row"><span id="kPort"></span><span id="lsPort">-</span></div>
        <div class="status-row"><span id="kMax"></span><span id="lsMax">-</span></div>
        <div class="status-note" id="subtitle"></div>
      </div>
    </aside>

    <main class="pane center-pane">
      <div class="cards">
        <div class="card"><div class="k" id="cardOnlineLabel"></div><div class="v v--brand" id="online">-</div></div>
        <div class="card"><div class="k" id="cardMaxLabel"></div><div class="v" id="maxPlayers">-</div></div>
        <div class="card"><div class="k" id="cardPortLabel"></div><div class="v" id="port">-</div></div>
        <div class="card"><div class="k" id="cardUptimeLabel"></div><div class="v" id="uptime">-</div></div>
      </div>

      <section class="panel active" id="panel-players">
        <div class="block">
          <div class="search-row"><input class="search-input" id="playerSearch" type="text" /></div>
          <div class="tbl-wrap">
            <table>
              <thead><tr><th id="hUser"></th><th id="hActor"></th><th id="hName"></th><th id="hIp"></th><th id="hPos"></th><th id="hActions"></th></tr></thead>
              <tbody id="playersBody"></tbody>
            </table>
          </div>
          <div class="status-bar" id="playerStatus"></div>
        </div>
      </section>

      <section class="panel" id="panel-console">
        <div class="block">
          <div class="console-out" id="consoleOut"></div>
          <div class="console-row">
            <input class="console-input" id="consoleInput" type="text" />
            <button class="btn btn-send" id="consoleSendBtn"></button>
          </div>
        </div>
      </section>

      <section class="panel" id="panel-logs">
        <div class="block">
          <div class="log-filters">
            <button class="log-filter active" data-type="" id="fAll"></button>
            <button class="log-filter" data-type="kick" id="fKick"></button>
            <button class="log-filter" data-type="ban" id="fBan"></button>
            <button class="log-filter" data-type="console" id="fConsole"></button>
          </div>
          <div class="log-list" id="logList"></div>
        </div>
      </section>

      <section class="panel" id="panel-resources">
        <div class="block">
          <div class="search-row"><input class="search-input" id="resourceSearch" type="text" /></div>
          <div class="tbl-wrap">
            <table>
              <thead><tr><th id="rhName"></th><th id="rhKind"></th><th id="rhPath"></th><th id="rhSize"></th><th id="rhUpdated"></th></tr></thead>
              <tbody id="resourcesBody"></tbody>
            </table>
          </div>
          <div class="status-bar" id="resourceStatus"></div>
        </div>
      </section>

      <section class="panel" id="panel-cfg">
        <div class="block">
          <div class="search-row">
            <button class="btn" id="cfgLoadBtn"></button>
            <button class="btn" id="cfgFormatBtn"></button>
            <button class="btn btn-send" id="cfgSaveBtn"></button>
            <button class="btn" id="cfgApplyAccessBtn"></button>
            <button class="btn" id="cfgSaveAccessBtn"></button>
          </div>
          <div class="status-bar" id="accessTitle" style="font-weight:700;margin-top:2px;"></div>
          <div class="search-row" style="align-items:center;">
            <label class="muted" style="min-width:170px;" id="joinModeLabel"></label>
            <select class="search-input" id="accessJoinMode">
              <option value="open">Open</option>
              <option value="adminOnly">Admin Only</option>
              <option value="approvedLicense">Approved License</option>
              <option value="discordMember">Discord Member</option>
              <option value="discordRoles">Discord Roles</option>
            </select>
          </div>
          <div class="search-row" style="align-items:center;">
            <label class="muted" style="min-width:170px;" id="joinRejectLabel"></label>
            <input class="search-input" id="accessRejectMessage" type="text" />
          </div>
          <div class="search-row" style="align-items:center;">
            <label class="muted" style="min-width:170px;" id="joinLicensesLabel"></label>
            <input class="search-input" id="accessLicenses" type="text" />
          </div>
          <div class="search-row" style="align-items:center;">
            <label class="muted" style="min-width:170px;" id="joinDiscordIdsLabel"></label>
            <input class="search-input" id="accessDiscordIds" type="text" />
          </div>
          <div class="search-row" style="align-items:center;">
            <label class="muted" style="min-width:170px;" id="joinDiscordRolesLabel"></label>
            <input class="search-input" id="accessDiscordRoles" type="text" />
          </div>

          <div class="status-bar" id="discordTitle" style="font-weight:700;margin-top:2px;"></div>
          <div class="search-row" style="align-items:center;">
            <label class="muted" style="min-width:170px;" id="discordEnabledLabel"></label>
            <input id="discordEnabled" type="checkbox" style="width:18px;height:18px;" />
          </div>
          <div class="search-row" style="align-items:center;">
            <label class="muted" style="min-width:170px;" id="discordTokenLabel"></label>
            <input class="search-input" id="discordToken" type="password" autocomplete="off" />
          </div>
          <div class="search-row" style="align-items:center;">
            <label class="muted" style="min-width:170px;" id="discordGuildLabel"></label>
            <input class="search-input" id="discordGuildId" type="text" />
          </div>
          <div class="search-row" style="align-items:center;">
            <label class="muted" style="min-width:170px;" id="discordWarningsLabel"></label>
            <input class="search-input" id="discordWarningsChannel" type="text" />
          </div>

          <textarea class="console-input" id="cfgEditor" style="height:420px;resize:vertical;font-family:Consolas, 'Courier New', monospace;line-height:1.45;"></textarea>
          <div class="status-bar" id="cfgStatus"></div>
          <div class="coming-soon" id="cfgPlaceholder"></div>
        </div>
      </section>
    </main>

    <aside class="pane right-pane">
      <div class="online-box">
        <div class="k" id="rightPlayersLabel"></div>
        <div class="value" id="rightPlayersCount">0</div>
      </div>
      <input class="search-input" id="rightPlayerSearch" type="text" />
      <div class="mini-list" id="rightPlayersList"></div>
    </aside>
  </div>

  <script>
    const I18N = {
      en: {
        title: 'SkyMP Admin', subtitle: 'Live server control panel',
        online: 'Online', maxPlayers: 'Max Players', port: 'Port', uptime: 'Uptime',
        tabPlayers: 'Players', tabConsole: 'Live Console', tabLogs: 'Server Log', tabResources: 'Resources', tabCfg: 'CFG Editor',
        leftPanelTitle: 'SERVER PANEL', user: 'User ID', actor: 'Actor ID', name: 'Name', ip: 'IP', pos: 'Position', actions: 'Actions',
        kick: 'Kick', ban: 'Ban', noPlayers: 'No players online', updated: 'Updated',
        kicked: 'Kicked', banned: 'Banned', searchPlaceholder: 'Filter players by id, name or ip...',
        resourceSearchPlaceholder: 'Filter mods and scripts...',
        rightSearchPlaceholder: 'Filter side list...', consoleSend: 'Execute', consoleHint: '> Enter JavaScript command',
        sent: 'Command sent', apiError: 'API error', noLogs: 'No log entries',
        fAll: 'All', fKick: 'Kick', fBan: 'Ban', fConsole: 'Console',
        resourcesPlaceholder: 'Skyrim-relevant resources currently available on this server instance (.esm and .pex).',
        resourceName: 'Resource', resourceKind: 'Type', resourcePath: 'Path', resourceSize: 'Size', resourceUpdated: 'Updated',
        resourceTypeMod: 'Mod', resourceTypeScript: 'Script',
        resourcesLoaded: 'Resources loaded',
        cfgPlaceholder: 'Use localeRouting.defaultLanguage and localeRouting.countryCodeToLanguage to control language loading by country code (e.g. DE -> de, US -> en).',
        cfgLoad: 'Load', cfgFormat: 'Format JSON', cfgSave: 'Save',
        cfgApplyAccess: 'Apply Access/Discord', cfgSaveAccess: 'Save Access/Discord',
        accessTitle: 'Who can join (txAdmin style)',
        joinModeLabel: 'Join mode', joinRejectLabel: 'Reject message',
        joinLicensesLabel: 'Approved licenses (comma)',
        joinDiscordIdsLabel: 'Approved Discord IDs (comma)',
        joinDiscordRolesLabel: 'Required Discord role IDs (comma)',
        discordTitle: 'Discord bot settings',
        discordEnabledLabel: 'Enabled', discordTokenLabel: 'Bot token',
        discordGuildLabel: 'Guild/Server ID', discordWarningsLabel: 'Warnings channel ID',
        cfgValidationPrefix: 'Validation failed',
        cfgValidationNeedWhitelist: 'At least one approved license is required for approvedLicense mode',
        cfgValidationInvalidDiscordIds: 'Approved Discord IDs must be numeric snowflake IDs',
        cfgValidationInvalidDiscordRoles: 'Required Discord role IDs must be numeric snowflake IDs',
        cfgValidationNeedDiscordSetup: 'Discord bot token and guild ID are required for this join mode',
        cfgValidationNeedDiscordRoles: 'At least one required Discord role ID is required for discordRoles mode',
        accessApplied: 'Access/Discord settings applied to JSON editor',
        cfgLoaded: 'Config loaded', cfgSaved: 'Config saved. Restart server to apply runtime changes.', cfgInvalidJson: 'Invalid JSON',
        noPlayersSide: 'No players online'
      },
      de: {
        title: 'SkyMP Admin', subtitle: 'Live-Server-Kontrollzentrum',
        online: 'Online', maxPlayers: 'Max. Spieler', port: 'Port', uptime: 'Laufzeit',
        tabPlayers: 'Spieler', tabConsole: 'Live-Konsole', tabLogs: 'Server-Log', tabResources: 'Ressourcen', tabCfg: 'CFG Editor',
        leftPanelTitle: 'SERVER PANEL', user: 'Benutzer-ID', actor: 'Actor-ID', name: 'Name', ip: 'IP', pos: 'Position', actions: 'Aktionen',
        kick: 'Kicken', ban: 'Bannen', noPlayers: 'Keine Spieler online', updated: 'Aktualisiert',
        kicked: 'Gekickt', banned: 'Gebannt', searchPlaceholder: 'Spieler nach ID, Name oder IP filtern...',
        resourceSearchPlaceholder: 'Mods und Scripts filtern...',
        rightSearchPlaceholder: 'Seitenliste filtern...', consoleSend: 'Ausfuehren', consoleHint: '> JavaScript-Befehl eingeben',
        sent: 'Befehl gesendet', apiError: 'API-Fehler', noLogs: 'Keine Log-Eintraege',
        fAll: 'Alle', fKick: 'Kick', fBan: 'Ban', fConsole: 'Konsole',
        resourcesPlaceholder: 'Skyrim-relevante Ressourcen auf dieser Server-Instanz (.esm und .pex).',
        resourceName: 'Ressource', resourceKind: 'Typ', resourcePath: 'Pfad', resourceSize: 'Groesse', resourceUpdated: 'Aktualisiert',
        resourceTypeMod: 'Mod', resourceTypeScript: 'Script',
        resourcesLoaded: 'Ressourcen geladen',
        cfgPlaceholder: 'Nutze localeRouting.defaultLanguage und localeRouting.countryCodeToLanguage fuer Sprachwahl nach Laendercode (z.B. DE -> de, US -> en).',
        cfgLoad: 'Laden', cfgFormat: 'JSON formatieren', cfgSave: 'Speichern',
        cfgApplyAccess: 'Access/Discord uebernehmen', cfgSaveAccess: 'Access/Discord speichern',
        accessTitle: 'Wer darf beitreten (txAdmin-Stil)',
        joinModeLabel: 'Join-Modus', joinRejectLabel: 'Ablehnungsnachricht',
        joinLicensesLabel: 'Freigegebene Lizenzen (Komma)',
        joinDiscordIdsLabel: 'Freigegebene Discord-IDs (Komma)',
        joinDiscordRolesLabel: 'Noetige Discord-Rollen-IDs (Komma)',
        discordTitle: 'Discord-Bot-Einstellungen',
        discordEnabledLabel: 'Aktiv', discordTokenLabel: 'Bot-Token',
        discordGuildLabel: 'Guild/Server-ID', discordWarningsLabel: 'Warnings-Channel-ID',
        cfgValidationPrefix: 'Validierung fehlgeschlagen',
        cfgValidationNeedWhitelist: 'Mindestens eine freigegebene Lizenz ist fuer den Modus approvedLicense erforderlich',
        cfgValidationInvalidDiscordIds: 'Freigegebene Discord-IDs muessen numerische Snowflake-IDs sein',
        cfgValidationInvalidDiscordRoles: 'Discord-Rollen-IDs muessen numerische Snowflake-IDs sein',
        cfgValidationNeedDiscordSetup: 'Discord-Bot-Token und Guild-ID sind fuer diesen Join-Modus erforderlich',
        cfgValidationNeedDiscordRoles: 'Mindestens eine Discord-Rollen-ID ist fuer den Modus discordRoles erforderlich',
        accessApplied: 'Access/Discord in JSON-Editor uebernommen',
        cfgLoaded: 'Config geladen', cfgSaved: 'Config gespeichert. Server-Neustart noetig fuer Laufzeit-Aenderungen.', cfgInvalidJson: 'Ungueltiges JSON',
        noPlayersSide: 'Keine Spieler online'
      }
    };

    const lang = (navigator.language || 'en').slice(0,2).toLowerCase();
    const t = I18N[lang] || I18N.en;
    const el = (id) => document.getElementById(id);
    const setText = (id, value) => { const e = el(id); if (e) e.textContent = value; };
    const escapeHtml = (text) => String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');

    setText('title', t.title);
    setText('subtitle', t.subtitle);
    setText('kOnline', t.online);
    setText('kUptime', t.uptime);
    setText('kPort', t.port);
    setText('kMax', t.maxPlayers);
    setText('cardOnlineLabel', t.online);
    setText('cardMaxLabel', t.maxPlayers);
    setText('cardPortLabel', t.port);
    setText('cardUptimeLabel', t.uptime);
    setText('tabPlayers', t.tabPlayers);
    setText('tabConsole', t.tabConsole);
    setText('tabLogs', t.tabLogs);
    setText('tabResources', t.tabResources);
    setText('tabCfg', t.tabCfg);
    setText('quickPlayers', t.tabPlayers);
    setText('quickConsole', t.tabConsole);
    setText('quickLogs', t.tabLogs);
    setText('quickResources', t.tabResources);
    setText('quickCfg', t.tabCfg);
    setText('leftPanelTitle', t.leftPanelTitle);
    setText('hUser', t.user);
    setText('hActor', t.actor);
    setText('hName', t.name);
    setText('hIp', t.ip);
    setText('hPos', t.pos);
    setText('hActions', t.actions);
    setText('rhName', t.resourceName);
    setText('rhKind', t.resourceKind);
    setText('rhPath', t.resourcePath);
    setText('rhSize', t.resourceSize);
    setText('rhUpdated', t.resourceUpdated);
    setText('consoleSendBtn', t.consoleSend);
    setText('fAll', t.fAll);
    setText('fKick', t.fKick);
    setText('fBan', t.fBan);
    setText('fConsole', t.fConsole);
    setText('resourcesPlaceholder', t.resourcesPlaceholder);
    setText('cfgPlaceholder', t.cfgPlaceholder);
    setText('cfgLoadBtn', t.cfgLoad);
    setText('cfgFormatBtn', t.cfgFormat);
    setText('cfgSaveBtn', t.cfgSave);
    setText('cfgApplyAccessBtn', t.cfgApplyAccess);
    setText('cfgSaveAccessBtn', t.cfgSaveAccess);
    setText('accessTitle', t.accessTitle);
    setText('joinModeLabel', t.joinModeLabel);
    setText('joinRejectLabel', t.joinRejectLabel);
    setText('joinLicensesLabel', t.joinLicensesLabel);
    setText('joinDiscordIdsLabel', t.joinDiscordIdsLabel);
    setText('joinDiscordRolesLabel', t.joinDiscordRolesLabel);
    setText('discordTitle', t.discordTitle);
    setText('discordEnabledLabel', t.discordEnabledLabel);
    setText('discordTokenLabel', t.discordTokenLabel);
    setText('discordGuildLabel', t.discordGuildLabel);
    setText('discordWarningsLabel', t.discordWarningsLabel);
    setText('rightPlayersLabel', t.online + ' / ' + t.tabPlayers);

    el('playerSearch').placeholder = t.searchPlaceholder;
    el('resourceSearch').placeholder = t.resourceSearchPlaceholder;
    el('rightPlayerSearch').placeholder = t.rightSearchPlaceholder;
    el('consoleInput').placeholder = t.consoleHint;
    el('accessRejectMessage').placeholder = t.joinRejectLabel;
    el('accessLicenses').placeholder = 'license:abc, steam:123';
    el('accessDiscordIds').placeholder = '123456789012345678, 987654321098765432';
    el('accessDiscordRoles').placeholder = '987654321098765432';
    el('discordToken').placeholder = 'Discord bot token';
    el('discordGuildId').placeholder = 'Discord guild id';
    el('discordWarningsChannel').placeholder = 'Discord channel id';

    let activeTab = 'players';
    let allPlayers = [];
    let allResources = [];
    let logTypeFilter = '';
    let cfgLoadedOnce = false;

    const switchTab = (nextTab) => {
      activeTab = nextTab;
      document.querySelectorAll('.tab').forEach((button) => {
        const isActive = button.dataset.tab === nextTab;
        button.classList.toggle('active', isActive);
      });
      document.querySelectorAll('.panel').forEach((panel) => {
        panel.classList.toggle('active', panel.id === ('panel-' + nextTab));
      });
      if (nextTab === 'logs') refreshLogs();
      if (nextTab === 'resources') refreshResources();
      if (nextTab === 'cfg' && !cfgLoadedOnce) refreshCfgEditor();
    };

    document.querySelectorAll('.tab').forEach((button) => {
      button.addEventListener('click', () => switchTab(button.dataset.tab));
    });

    document.querySelectorAll('.log-filter').forEach((button) => {
      button.addEventListener('click', () => {
        logTypeFilter = button.dataset.type;
        document.querySelectorAll('.log-filter').forEach((n) => n.classList.remove('active'));
        button.classList.add('active');
        refreshLogs();
      });
    });

    const fmtUptime = (seconds) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      if (h > 0) return h + 'h ' + m + 'm';
      if (m > 0) return m + 'm ' + s + 's';
      return s + 's';
    };

    const fmtTime = (timestamp) => new Date(timestamp).toLocaleTimeString();
    const fmtDateTime = (timestamp) => timestamp ? new Date(timestamp).toLocaleString() : '-';
    const fmtSize = (bytes) => {
      const num = Number(bytes || 0);
      if (!Number.isFinite(num) || num <= 0) return '-';
      if (num < 1024) return num + ' B';
      if (num < 1024 * 1024) return (num / 1024).toFixed(1) + ' KB';
      if (num < 1024 * 1024 * 1024) return (num / (1024 * 1024)).toFixed(1) + ' MB';
      return (num / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    };

    const renderSidePlayers = () => {
      const query = String(el('rightPlayerSearch').value || '').toLowerCase();
      const list = el('rightPlayersList');
      const filtered = query
        ? allPlayers.filter((p) => String(p.userId).includes(query) || String(p.actorName || '').toLowerCase().includes(query) || String(p.ip || '').includes(query))
        : allPlayers;
      list.innerHTML = '';
      if (!filtered.length) {
        list.innerHTML = '<div class="mini-item">' + t.noPlayersSide + '</div>';
        return;
      }
      for (const p of filtered.slice(0, 32)) {
        const row = document.createElement('div');
        row.className = 'mini-item';
        row.innerHTML = '#' + escapeHtml(String(p.userId)) + ' ' + escapeHtml(String(p.actorName || '-')) + '<small>' + escapeHtml(String(p.ip || '-')) + '</small>';
        list.appendChild(row);
      }
    };

    const renderPlayers = () => {
      const query = String(el('playerSearch').value || '').toLowerCase();
      const filtered = query
        ? allPlayers.filter((p) => String(p.userId).includes(query) || String(p.actorName || '').toLowerCase().includes(query) || String(p.ip || '').includes(query))
        : allPlayers;

      const tbody = el('playersBody');
      tbody.innerHTML = '';

      if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">' + (allPlayers.length ? 'No match' : t.noPlayers) + '</td></tr>';
        renderSidePlayers();
        return;
      }

      for (const p of filtered) {
        const pos = Array.isArray(p.pos) ? p.pos.map((n) => Math.round(Number(n))).join(', ') : '-';
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + escapeHtml(String(p.userId)) + '</td>' +
          '<td>' + escapeHtml(String(p.actorId || '-')) + '</td>' +
          '<td>' + escapeHtml(String(p.actorName || '-')) + '</td>' +
          '<td>' + escapeHtml(String(p.ip || '-')) + '</td>' +
          '<td class="pos">' + escapeHtml(pos) + '</td>';

        const actionCell = document.createElement('td');
        const kickBtn = document.createElement('button');
        kickBtn.className = 'btn btn-kick';
        kickBtn.textContent = t.kick;
        kickBtn.onclick = () => kickPlayer(p.userId);

        const banBtn = document.createElement('button');
        banBtn.className = 'btn btn-ban';
        banBtn.textContent = t.ban;
        banBtn.onclick = () => banPlayer(p.userId);

        actionCell.append(kickBtn, banBtn);
        tr.appendChild(actionCell);
        tbody.appendChild(tr);
      }

      renderSidePlayers();
    };

    el('playerSearch').addEventListener('input', renderPlayers);
    el('rightPlayerSearch').addEventListener('input', renderSidePlayers);
    el('resourceSearch').addEventListener('input', () => renderResources());

    const renderResources = () => {
      const query = String(el('resourceSearch').value || '').toLowerCase();
      const filtered = query
        ? allResources.filter((entry) => {
          return String(entry.name || '').toLowerCase().includes(query)
            || String(entry.path || '').toLowerCase().includes(query)
            || String(entry.kind || '').toLowerCase().includes(query);
        })
        : allResources;

      const tbody = el('resourcesBody');
      tbody.innerHTML = '';

      if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">' + t.noLogs + '</td></tr>';
        return;
      }

      for (const entry of filtered) {
        const tr = document.createElement('tr');
        const kindLabel = String(entry.kind || '').toLowerCase() === 'mod' ? t.resourceTypeMod : t.resourceTypeScript;
        tr.innerHTML =
          '<td>' + escapeHtml(String(entry.name || '-')) + '</td>' +
          '<td>' + escapeHtml(kindLabel) + '</td>' +
          '<td>' + escapeHtml(String(entry.path || '-')) + '</td>' +
          '<td>' + escapeHtml(fmtSize(entry.size)) + '</td>' +
          '<td>' + escapeHtml(fmtDateTime(entry.mtimeMs)) + '</td>';
        tbody.appendChild(tr);
      }
    };

    const refreshResources = async () => {
      const response = await fetch('/api/admin/resources');
      if (!response.ok) {
        setText('resourceStatus', t.apiError);
        return;
      }

      const data = await response.json();
      allResources = Array.isArray(data.entries) ? data.entries : [];
      renderResources();
      setText('resourceStatus', t.resourcesLoaded + ': ' + String(data.total ?? allResources.length));
    };

    const parseCommaList = (value) => {
      const items = String(value || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      return Array.from(new Set(items));
    };

    const normalizeJoinMode = (mode) => {
      const value = String(mode || '').trim();
      if (value === 'adminOnly' || value === 'approvedLicense' || value === 'discordMember' || value === 'discordRoles' || value === 'open') {
        return value;
      }
      return 'open';
    };

    const isSnowflakeId = (value) => /^[0-9]{15,25}$/.test(String(value || '').trim());

    const validateAccessDiscordFormData = (formData) => {
      const mode = normalizeJoinMode(formData?.joinAccess?.mode);
      const approvedLicenses = Array.isArray(formData?.joinAccess?.approvedLicenses) ? formData.joinAccess.approvedLicenses : [];
      const approvedDiscordIds = Array.isArray(formData?.joinAccess?.approvedDiscordIds) ? formData.joinAccess.approvedDiscordIds : [];
      const discordRoleIds = Array.isArray(formData?.joinAccess?.discordRoleIds) ? formData.joinAccess.discordRoleIds : [];
      const token = String(formData?.discordBot?.token || '').trim();
      const guildId = String(formData?.discordBot?.guildId || '').trim();

      if (mode === 'approvedLicense' && approvedLicenses.length === 0) {
        return t.cfgValidationNeedWhitelist;
      }

      if (approvedDiscordIds.some((id) => !isSnowflakeId(id))) {
        return t.cfgValidationInvalidDiscordIds;
      }

      if (discordRoleIds.some((id) => !isSnowflakeId(id))) {
        return t.cfgValidationInvalidDiscordRoles;
      }

      if ((mode === 'discordMember' || mode === 'discordRoles') && (!token || !guildId)) {
        return t.cfgValidationNeedDiscordSetup;
      }

      if (mode === 'discordRoles' && discordRoleIds.length === 0) {
        return t.cfgValidationNeedDiscordRoles;
      }

      return null;
    };

    const readAccessDiscordFromForm = () => {
      return {
        joinAccess: {
          mode: normalizeJoinMode(el('accessJoinMode').value),
          rejectionMessage: String(el('accessRejectMessage').value || '').trim(),
          approvedLicenses: parseCommaList(el('accessLicenses').value),
          approvedDiscordIds: parseCommaList(el('accessDiscordIds').value),
          discordRoleIds: parseCommaList(el('accessDiscordRoles').value),
        },
        discordBot: {
          enabled: Boolean(el('discordEnabled').checked),
          token: String(el('discordToken').value || '').trim(),
          guildId: String(el('discordGuildId').value || '').trim(),
          warningsChannelId: String(el('discordWarningsChannel').value || '').trim(),
        }
      };
    };

    const applyAccessDiscordToForm = (parsed) => {
      const joinAccess = parsed && typeof parsed === 'object' && parsed.joinAccess && typeof parsed.joinAccess === 'object'
        ? parsed.joinAccess
        : {};
      const discordAuth = parsed && typeof parsed === 'object' && parsed.discordAuth && typeof parsed.discordAuth === 'object'
        ? parsed.discordAuth
        : {};
      const discordBot = parsed && typeof parsed === 'object' && parsed.discordBot && typeof parsed.discordBot === 'object'
        ? parsed.discordBot
        : {};

      el('accessJoinMode').value = normalizeJoinMode(joinAccess.mode);
      el('accessRejectMessage').value = String(joinAccess.rejectionMessage || 'Access denied. Please contact server staff for whitelist approval.');
      el('accessLicenses').value = Array.isArray(joinAccess.approvedLicenses) ? joinAccess.approvedLicenses.join(', ') : '';
      el('accessDiscordIds').value = Array.isArray(joinAccess.approvedDiscordIds) ? joinAccess.approvedDiscordIds.join(', ') : '';
      el('accessDiscordRoles').value = Array.isArray(joinAccess.discordRoleIds) ? joinAccess.discordRoleIds.join(', ') : '';

      el('discordEnabled').checked = Boolean(discordBot.enabled);
      el('discordToken').value = String(discordBot.token || discordAuth.botToken || '');
      el('discordGuildId').value = String(discordBot.guildId || discordAuth.guildId || '');
      el('discordWarningsChannel').value = String(discordBot.warningsChannelId || discordAuth.eventLogChannelId || '');
    };

    const mergeAccessDiscordIntoParsed = (parsed) => {
      const next = parsed && typeof parsed === 'object' ? parsed : {};
      const formData = readAccessDiscordFromForm();
      next.joinAccess = formData.joinAccess;
      next.discordBot = formData.discordBot;
      const existingDiscordAuth = next.discordAuth && typeof next.discordAuth === 'object' ? next.discordAuth : {};
      next.discordAuth = {
        ...existingDiscordAuth,
        botToken: formData.discordBot.token,
        guildId: formData.discordBot.guildId,
        eventLogChannelId: formData.discordBot.warningsChannelId,
      };
      return next;
    };

    const applyAccessDiscordToEditor = () => {
      const editor = el('cfgEditor');
      let parsed;
      try {
        parsed = JSON.parse(String(editor.value || '{}'));
      } catch {
        setText('cfgStatus', t.cfgInvalidJson);
        return null;
      }

      const merged = mergeAccessDiscordIntoParsed(parsed);
      editor.value = JSON.stringify(merged, null, 2);
      setText('cfgStatus', t.accessApplied);
      return merged;
    };

    const refreshCfgEditor = async () => {
      const response = await fetch('/api/admin/cfg/server-settings');
      if (!response.ok) {
        setText('cfgStatus', t.apiError);
        return;
      }

      const data = await response.json();
      el('cfgEditor').value = String(data.json || '');
      try {
        applyAccessDiscordToForm(JSON.parse(String(data.json || '{}')));
      } catch {
        // Keep editor text untouched and show generic status below.
      }
      setText('cfgStatus', t.cfgLoaded + (data.path ? (': ' + data.path) : ''));
      cfgLoadedOnce = true;
    };

    const formatCfgEditor = () => {
      const editor = el('cfgEditor');
      try {
        const parsed = JSON.parse(String(editor.value || ''));
        editor.value = JSON.stringify(parsed, null, 2);
        setText('cfgStatus', t.cfgLoaded);
      } catch {
        setText('cfgStatus', t.cfgInvalidJson);
      }
    };

    const saveCfgEditor = async () => {
      const editor = el('cfgEditor');
      let parsed;
      try {
        parsed = JSON.parse(String(editor.value || ''));
      } catch {
        setText('cfgStatus', t.cfgInvalidJson);
        return;
      }

      const formData = readAccessDiscordFromForm();
      const validationError = validateAccessDiscordFormData(formData);
      if (validationError) {
        setText('cfgStatus', t.cfgValidationPrefix + ': ' + validationError);
        return;
      }

      parsed = mergeAccessDiscordIntoParsed(parsed);
      const normalized = JSON.stringify(parsed, null, 2);
      editor.value = normalized;

      const response = await fetch('/api/admin/cfg/server-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: normalized }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        setText('cfgStatus', t.apiError + ': ' + errorText.slice(0, 160));
        return;
      }

      setText('cfgStatus', t.cfgSaved);
    };

    el('cfgLoadBtn').addEventListener('click', refreshCfgEditor);
    el('cfgFormatBtn').addEventListener('click', formatCfgEditor);
    el('cfgSaveBtn').addEventListener('click', saveCfgEditor);
    el('cfgApplyAccessBtn').addEventListener('click', applyAccessDiscordToEditor);
    el('cfgSaveAccessBtn').addEventListener('click', async () => {
      const applied = applyAccessDiscordToEditor();
      if (!applied) return;
      await saveCfgEditor();
    });

    const kickPlayer = async (userId) => {
      const response = await fetch('/api/admin/players/' + userId + '/kick', { method: 'POST' });
      setText('playerStatus', response.ok ? (t.kicked + ' #' + userId) : t.apiError);
      if (response.ok) await refreshPlayers();
    };

    const banPlayer = async (userId) => {
      if (!confirm(t.ban + ' userId=' + userId + '?')) return;
      const response = await fetch('/api/admin/players/' + userId + '/ban', { method: 'POST' });
      setText('playerStatus', response.ok ? (t.banned + ' #' + userId) : t.apiError);
      if (response.ok) await refreshPlayers();
    };

    const refreshPlayers = async () => {
      const [statusResponse, playersResponse] = await Promise.all([
        fetch('/api/admin/status'),
        fetch('/api/admin/players'),
      ]);

      if (!statusResponse.ok || !playersResponse.ok) {
        setText('playerStatus', t.apiError);
        return;
      }

      const status = await statusResponse.json();
      allPlayers = await playersResponse.json();

      const uptimeText = fmtUptime(Number(status.uptimeSec || 0));
      const onlineText = String(status.online ?? 0);
      const maxText = String(status.maxPlayers ?? 0);
      const portText = String(status.port ?? '-');

      setText('online', onlineText);
      setText('maxPlayers', maxText);
      setText('port', portText);
      setText('uptime', uptimeText);
      setText('onlineBadge', onlineText + '/' + maxText);
      setText('lsUptime', uptimeText);
      setText('lsPort', portText);
      setText('lsMax', maxText);
      setText('rightPlayersCount', onlineText);
      setText('updatedAt', t.updated + ': ' + new Date().toLocaleTimeString());

      renderPlayers();
    };

    const appendConsole = (line, color) => {
      const out = el('consoleOut');
      const row = document.createElement('div');
      row.textContent = line;
      if (color) row.style.color = color;
      out.appendChild(row);
      out.scrollTop = out.scrollHeight;
    };

    const sendConsole = async () => {
      const input = el('consoleInput');
      const command = String(input.value || '').trim();
      if (!command) return;

      appendConsole('> ' + command, 'var(--muted)');
      input.value = '';

      const response = await fetch('/api/admin/console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: command }),
      });

      appendConsole(response.ok ? t.sent : t.apiError, response.ok ? '#8ef7ef' : '#ff9e97');
    };

    el('consoleSendBtn').addEventListener('click', sendConsole);
    el('consoleInput').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') sendConsole();
    });

    const refreshLogs = async () => {
      const url = logTypeFilter ? ('/api/admin/logs?type=' + logTypeFilter) : '/api/admin/logs';
      const response = await fetch(url);
      if (!response.ok) return;

      const entries = await response.json();
      const list = el('logList');
      list.innerHTML = '';

      if (!entries.length) {
        list.innerHTML = '<div class="no-data">' + t.noLogs + '</div>';
        return;
      }

      for (const entry of entries) {
        const row = document.createElement('div');
        row.className = 'log-entry';
        row.innerHTML =
          '<span class="log-ts">' + escapeHtml(fmtTime(entry.ts)) + '</span>' +
          '<span class="log-type log-type--' + escapeHtml(String(entry.type || 'console')) + '">' + escapeHtml(String(entry.type || 'log')) + '</span>' +
          '<span class="log-msg">' + escapeHtml(String(entry.message || '')) + '</span>';
        list.appendChild(row);
      }
    };

    switchTab('players');
    refreshPlayers();
    setInterval(() => { if (activeTab === 'players') refreshPlayers(); }, 5000);
    setInterval(() => { if (activeTab === 'logs') refreshLogs(); }, 5000);
    setInterval(() => { if (activeTab === 'resources') refreshResources(); }, 10000);
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
    router.use('/admin', auth({ name: adminAuth.user, pass: adminAuth.password }));
    router.use('/api/admin', auth({ name: adminAuth.user, pass: adminAuth.password }));

    router.get('/admin', (ctx: any) => {
      ctx.type = 'text/html; charset=utf-8';
      ctx.body = renderAdminDashboard();
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
