import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FrameButton } from '../../components/FrameButton/FrameButton';
import { filterAdminPlayers, formatAdminPos, formatAdminTime, formatAdminUptime } from './utils';
import { RespawnPanel, DownedPlayerEntry } from './RespawnPanel';
import { EventsPanel, RevivalEventEntry } from './EventsPanel';
import { ITEM_CATALOG, ITEM_CATEGORIES, ItemCategory } from './itemCatalog';
import { detectLanguage, persistRuntimeLanguage } from '../../utils/i18nLanguage';
import './styles.scss';

type Tab = 'overview' | 'players' | 'console' | 'logs' | 'metrics' | 'respawn' | 'events' | 'cfg';
type TopSection = 'players' | 'history' | 'playerDrops' | 'whitelist' | 'admins' | 'settings' | 'system';
type AdminRole = 'admin' | 'moderator' | 'viewer';
type ServerLogLevel = 'info' | 'error';

interface AdminStatus {
  name: string;
  online: number;
  maxPlayers: number;
  port: number;
  uptimeSec: number;
}

interface PlayerPos {
  x: number;
  y: number;
  z: number;
}

interface AdminPlayer {
  userId: number;
  actorId: number;
  actorName: string;
  ip: string;
  pos: PlayerPos | number[];
}

interface LogEntry {
  ts: number;
  type: 'kick' | 'ban' | 'mute' | 'console' | 'server';
  message: string;
  level?: ServerLogLevel;
}

interface MutedUserEntry {
  userId: number;
  expiresAt: number;
  remainingSec: number;
}

interface BannedUserEntry {
  userId: number;
  permanent: boolean;
  expiresAt: number | null;
  remainingSec: number | null;
}

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

interface FrontendMetricsSummary {
  totalCount: number;
  errorCount: number;
  lastReceivedAt: number | null;
  averageValue: number;
  sources: Array<{ name: string; count: number }>;
  names: Array<{ name: string; count: number }>;
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

interface ClientRuntimeEventsSummary {
  totalCount: number;
  errorCount: number;
  warnCount: number;
  lastReceivedAt: number | null;
  sources: Array<{ name: string; count: number }>;
  events: Array<{ name: string; count: number }>;
}

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

interface JoinAccessForm {
  mode: 'none' | 'approvedLicense' | 'discordMember' | 'discordRoles';
  rejectionMessage: string;
  approvedLicenses: string;
  approvedDiscordIds: string;
  discordRoleIds: string;
}

interface DiscordBotForm {
  enabled: boolean;
  token: string;
  guildId: string;
  warningsChannelId: string;
}

interface StarterInventoryRow {
  baseId: number;
  count: number;
  worn?: boolean;
  wornLeft?: boolean;
}

interface StartSpawnForm {
  x: number;
  y: number;
  z: number;
  worldOrCell: string;
  angleZ: number;
}

interface SpawnPreset extends StartSpawnForm {
  key: string;
  labelKey: string;
}

interface WorldOrCellOption {
  value: string;
  labelKey: string;
}

interface NpcDefaultSettingsForm {
  spawnInInterior: boolean;
  spawnInExterior: boolean;
  allowHumanoid: boolean;
  allowCreature: boolean;
}

interface CfgFormState {
  serverName: string;
  port: number;
  maxPlayers: number;
  offlineMode: boolean;
  defaultLanguage: string;
  startSpawn: StartSpawnForm;
  npcEnabled: boolean;
  npcDefaultSettings: NpcDefaultSettingsForm;
  joinAccess: JoinAccessForm;
  discordBot: DiscordBotForm;
  starterInventory: StarterInventoryRow[];
}

type CfgEditorTab = 'general' | 'access' | 'inventory' | 'json';

const DEFAULT_CAPABILITIES: AdminCapabilities = {
  canKick: true,
  canBan: true,
  canUnban: true,
  canConsole: true,
  canViewLogs: true,
  canMessage: true,
  canMute: true,
  canUnmute: true,
  canManageRespawn: true,
};

const EMPTY_FRONTEND_METRICS_SUMMARY: FrontendMetricsSummary = {
  totalCount: 0,
  errorCount: 0,
  lastReceivedAt: null,
  averageValue: 0,
  sources: [],
  names: [],
};

const EMPTY_CLIENT_RUNTIME_SUMMARY: ClientRuntimeEventsSummary = {
  totalCount: 0,
  errorCount: 0,
  warnCount: 0,
  lastReceivedAt: null,
  sources: [],
  events: [],
};

const REFRESH_INTERVAL_MS = 5000;
const ADMIN_DASHBOARD_STATE_KEY = 'skymp.adminDashboard.state.v1';

interface PersistedAdminDashboardState {
  activeTab?: Tab;
  playerSearch?: string;
  logTypeFilter?: '' | 'kick' | 'ban' | 'mute' | 'console' | 'server';
  logLevelFilter?: '' | ServerLogLevel;
  logLimit?: number;
  logSinceMinutes?: '' | '15' | '60' | '1440';
  metricLimit?: number;
  metricSourceFilter?: string;
  metricNameFilter?: string;
  eventTypeFilter?: '' | RevivalEventEntry['type'];
  eventLimit?: number;
  consoleHistory?: string[];
  cfgEditorText?: string;
}

const DEFAULT_CFG_FORM: CfgFormState = {
  serverName: '',
  port: 7777,
  maxPlayers: 100,
  offlineMode: false,
  defaultLanguage: 'en',
  startSpawn: {
    x: 133857,
    y: -61130,
    z: 14662,
    worldOrCell: '0x3c',
    angleZ: 72,
  },
  npcEnabled: false,
  npcDefaultSettings: {
    spawnInInterior: true,
    spawnInExterior: true,
    allowHumanoid: true,
    allowCreature: true,
  },
  joinAccess: {
    mode: 'none',
    rejectionMessage: 'Access denied. Please contact server staff for whitelist approval.',
    approvedLicenses: '',
    approvedDiscordIds: '',
    discordRoleIds: '',
  },
  discordBot: {
    enabled: false,
    token: '',
    guildId: '',
    warningsChannelId: '',
  },
  starterInventory: [],
};

const parseCommaList = (value: string): string[] => value
  .split(',')
  .map((entry) => entry.trim())
  .filter((entry) => entry.length > 0);

const parseItemCodeToBaseId = (code: string): number | null => {
  const normalized = String(code || '').trim().replace(/^0x/i, '').toUpperCase();
  if (!normalized) return null;
  if (!/^[0-9A-F]+$/.test(normalized)) return null;
  const parsed = parseInt(normalized, 16);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeWorldOrCell = (value: string): string => String(value || '').trim().toLowerCase();

const SPAWN_PRESETS: SpawnPreset[] = [
  {
    key: 'tamriel',
    labelKey: 'cfgSpawnPreset_tamriel',
    x: 133857,
    y: -61130,
    z: 14662,
    worldOrCell: '0x3c',
    angleZ: 72,
  },
  {
    key: 'whiterun',
    labelKey: 'cfgSpawnPreset_whiterun',
    x: 22659,
    y: -8697,
    z: -3594,
    worldOrCell: '0x1a26f',
    angleZ: 268,
  },
  {
    key: 'riften',
    labelKey: 'cfgSpawnPreset_riften',
    x: 172414.4688,
    y: -99692.1719,
    z: 11136.5918,
    worldOrCell: '0x16bb4',
    angleZ: 177.6169,
  },
  {
    key: 'markarth',
    labelKey: 'cfgSpawnPreset_markarth',
    x: -174156.5781,
    y: 7128.9624,
    z: -3105.9287,
    worldOrCell: '0x16d71',
    angleZ: 166.6154,
  },
  {
    key: 'windhelm',
    labelKey: 'cfgSpawnPreset_windhelm',
    x: 134123.7813,
    y: 36661.9023,
    z: -12252.2842,
    worldOrCell: '0xd45f0',
    angleZ: -83.5598,
  },
];

const WORLD_OR_CELL_HINTS: Record<string, string> = {
  '0x3c': 'cfgWorldOrCellHint_tamriel',
  '0x1a26f': 'cfgWorldOrCellHint_whiterun',
  '0x16bb4': 'cfgWorldOrCellHint_riften',
  '0x16d71': 'cfgWorldOrCellHint_markarth',
  '0xd45f0': 'cfgWorldOrCellHint_windhelm',
};

const WORLD_OR_CELL_OPTIONS: WorldOrCellOption[] = [
  { value: '0x3c', labelKey: 'cfgWorldOrCellOption_tamriel' },
  { value: '0x1a26f', labelKey: 'cfgWorldOrCellOption_whiterun' },
  { value: '0x16bb4', labelKey: 'cfgWorldOrCellOption_riften' },
  { value: '0x16d71', labelKey: 'cfgWorldOrCellOption_markarth' },
  { value: '0xd45f0', labelKey: 'cfgWorldOrCellOption_windhelm' },
];

const matchesSpawnPreset = (spawn: StartSpawnForm, preset: SpawnPreset): boolean => {
  const closeEnough = (left: number, right: number) => Math.abs(left - right) < 0.01;

  return normalizeWorldOrCell(spawn.worldOrCell) === normalizeWorldOrCell(preset.worldOrCell)
    && closeEnough(spawn.x, preset.x)
    && closeEnough(spawn.y, preset.y)
    && closeEnough(spawn.z, preset.z)
    && closeEnough(spawn.angleZ, preset.angleZ);
};

const toCodeHex = (baseId: number): string => baseId.toString(16).toUpperCase().padStart(8, '0');

const asRole = (value: unknown): AdminRole => {
  if (value === 'admin' || value === 'moderator' || value === 'viewer') return value;
  return 'viewer';
};

const AdminDashboard = () => {
  const { t, i18n } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [activeTopSection, setActiveTopSection] = useState<TopSection>('settings');
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [bannedUsers, setBannedUsers] = useState<BannedUserEntry[]>([]);
  const [banDurationMinutes, setBanDurationMinutes] = useState(0);
  const [mutedUsers, setMutedUsers] = useState<MutedUserEntry[]>([]);
  const [adminRole, setAdminRole] = useState<AdminRole>('viewer');
  const [adminUser, setAdminUser] = useState('');
  const [capabilities, setCapabilities] = useState<AdminCapabilities>(DEFAULT_CAPABILITIES);
  const [playerSearch, setPlayerSearch] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [loading, setLoading] = useState(false);
  const [consoleLines, setConsoleLines] = useState<Array<{ text: string; kind: 'input' | 'ok' | 'err' }>>([]);
  const [consoleInput, setConsoleInput] = useState('');
  const [consoleHistory, setConsoleHistory] = useState<string[]>([]);
  const [consoleHistoryIndex, setConsoleHistoryIndex] = useState<number | null>(null);
  const [consoleSending, setConsoleSending] = useState(false);
  const [cfgEditorText, setCfgEditorText] = useState('');
  const [cfgEditorStatus, setCfgEditorStatus] = useState('');
  const [cfgEditorLoading, setCfgEditorLoading] = useState(false);
  const [cfgEditorSaving, setCfgEditorSaving] = useState(false);
  const [cfgEditorTab, setCfgEditorTab] = useState<CfgEditorTab>('general');
  const [cfgForm, setCfgForm] = useState<CfgFormState>(DEFAULT_CFG_FORM);
  const [inventoryCategory, setInventoryCategory] = useState<ItemCategory>('weapons');
  const [inventoryItemCode, setInventoryItemCode] = useState('000139B5');
  const [inventoryCustomCode, setInventoryCustomCode] = useState('');
  const [inventoryCount, setInventoryCount] = useState(1);
  const [inventoryWorn, setInventoryWorn] = useState(false);
  const [inventoryWornLeft, setInventoryWornLeft] = useState(false);
  const [serverConsoleEntries, setServerConsoleEntries] = useState<LogEntry[]>([]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logTypeFilter, setLogTypeFilter] = useState<'' | 'kick' | 'ban' | 'mute' | 'console' | 'server'>('');
  const [logLevelFilter, setLogLevelFilter] = useState<'' | ServerLogLevel>('');
  const [logLimit, setLogLimit] = useState(100);
  const [logSinceMinutes, setLogSinceMinutes] = useState<'' | '15' | '60' | '1440'>('');
  const [logBeforeTs, setLogBeforeTs] = useState<number | null>(null);
  const [logHasMore, setLogHasMore] = useState(false);
  const [metricEntries, setMetricEntries] = useState<FrontendMetricEntry[]>([]);
  const [metricSummary, setMetricSummary] = useState<FrontendMetricsSummary>(EMPTY_FRONTEND_METRICS_SUMMARY);
  const [metricLimit, setMetricLimit] = useState(50);
  const [metricSourceFilter, setMetricSourceFilter] = useState('');
  const [metricNameFilter, setMetricNameFilter] = useState('');
  const [clientRuntimeEntries, setClientRuntimeEntries] = useState<ClientRuntimeEventEntry[]>([]);
  const [clientRuntimeSummary, setClientRuntimeSummary] = useState<ClientRuntimeEventsSummary>(EMPTY_CLIENT_RUNTIME_SUMMARY);
  const [downedPlayers, setDownedPlayers] = useState<DownedPlayerEntry[]>([]);
  const [revivalEvents, setRevivalEvents] = useState<RevivalEventEntry[]>([]);
  const [eventTypeFilter, setEventTypeFilter] = useState<'' | RevivalEventEntry['type']>('');
  const [eventLimit, setEventLimit] = useState(100);
  const [sendMsgTargetId, setSendMsgTargetId] = useState<number | null>(null);
  const [sendMsgTargetName, setSendMsgTargetName] = useState('');
  const [sendMsgText, setSendMsgText] = useState('');
  const [sendMsgSending, setSendMsgSending] = useState(false);
  const [sidebarActionSending, setSidebarActionSending] = useState<'kick-all' | 'announcement' | null>(null);
  const [muteDurationMinutes, setMuteDurationMinutes] = useState(10);
  const [moderationReason, setModerationReason] = useState('');
  const [nowTs, setNowTs] = useState(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ADMIN_DASHBOARD_STATE_KEY);
      if (!raw) return;
      const persisted = JSON.parse(raw) as PersistedAdminDashboardState;

      if (persisted.activeTab && ['overview', 'players', 'console', 'logs', 'metrics', 'respawn', 'events', 'cfg'].includes(persisted.activeTab)) {
        setActiveTab(persisted.activeTab);
      }
      if (typeof persisted.playerSearch === 'string') setPlayerSearch(persisted.playerSearch);
      if (persisted.logTypeFilter === '' || persisted.logTypeFilter === 'kick' || persisted.logTypeFilter === 'ban' || persisted.logTypeFilter === 'mute' || persisted.logTypeFilter === 'console' || persisted.logTypeFilter === 'server') {
        setLogTypeFilter(persisted.logTypeFilter);
      }
      if (persisted.logLevelFilter === '' || persisted.logLevelFilter === 'info' || persisted.logLevelFilter === 'error') {
        setLogLevelFilter(persisted.logLevelFilter);
      }
      if (persisted.logLimit && [25, 50, 100, 200].includes(persisted.logLimit)) setLogLimit(persisted.logLimit);
      if (persisted.logSinceMinutes === '' || persisted.logSinceMinutes === '15' || persisted.logSinceMinutes === '60' || persisted.logSinceMinutes === '1440') {
        setLogSinceMinutes(persisted.logSinceMinutes);
      }
      if (persisted.metricLimit && [25, 50, 100, 200].includes(persisted.metricLimit)) setMetricLimit(persisted.metricLimit);
      if (typeof persisted.metricSourceFilter === 'string') setMetricSourceFilter(persisted.metricSourceFilter);
      if (typeof persisted.metricNameFilter === 'string') setMetricNameFilter(persisted.metricNameFilter);
      if (persisted.eventTypeFilter === '' || persisted.eventTypeFilter === 'downed' || persisted.eventTypeFilter === 'revived' || persisted.eventTypeFilter === 'respawn_disabled' || persisted.eventTypeFilter === 'respawn_enabled' || persisted.eventTypeFilter === 'auto_revived') {
        setEventTypeFilter(persisted.eventTypeFilter);
      }
      if (persisted.eventLimit && [25, 50, 100, 200].includes(persisted.eventLimit)) setEventLimit(persisted.eventLimit);
      if (Array.isArray(persisted.consoleHistory)) {
        setConsoleHistory(persisted.consoleHistory.filter((entry) => typeof entry === 'string').slice(0, 30));
      }
      if (typeof persisted.cfgEditorText === 'string') {
        setCfgEditorText(persisted.cfgEditorText);
      }
    } catch {
      // ignore persisted state parsing issues
    }
  }, []);

  useEffect(() => {
    try {
      const stateToPersist: PersistedAdminDashboardState = {
        activeTab,
        playerSearch,
        logTypeFilter,
        logLevelFilter,
        logLimit,
        logSinceMinutes,
        metricLimit,
        metricSourceFilter,
        metricNameFilter,
        eventTypeFilter,
        eventLimit,
        consoleHistory,
        cfgEditorText,
      };
      window.localStorage.setItem(ADMIN_DASHBOARD_STATE_KEY, JSON.stringify(stateToPersist));
    } catch {
      // ignore storage write failures
    }
  }, [activeTab, cfgEditorText, consoleHistory, eventLimit, eventTypeFilter, logLevelFilter, logLimit, logSinceMinutes, logTypeFilter, metricLimit, metricNameFilter, metricSourceFilter, playerSearch]);

  const setForbiddenAwareStatus = useCallback((res: Response, successText: string) => {
    if (res.ok) {
      setStatusMsg(successText);
      return;
    }

    if (res.status === 403) {
      setStatusMsg(t('adminDashboard.noPermission'));
      return;
    }

    setStatusMsg(t('adminDashboard.apiError'));
  }, [t]);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, playersRes] = await Promise.all([
        fetch('/api/admin/status'),
        fetch('/api/admin/players'),
      ]);
      if (!statusRes.ok || !playersRes.ok) {
        setStatusMsg(t('adminDashboard.apiError'));
        return;
      }

      const statusData: AdminStatus = await statusRes.json();
      const playersData: AdminPlayer[] = await playersRes.json();
      setStatus(statusData);
      setPlayers(playersData);
      setLastUpdated(new Date().toLocaleTimeString());
      setStatusMsg('');
    } catch {
      setStatusMsg(t('adminDashboard.apiError'));
    }
  }, [t]);

  const fetchCapabilities = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/capabilities');
      if (!res.ok) return;

      const payload = await res.json();
      setAdminRole(asRole(payload?.role));
      setAdminUser(typeof payload?.user === 'string' ? payload.user : '');
      setCapabilities({
        canKick: typeof payload?.canKick === 'boolean' ? payload.canKick : DEFAULT_CAPABILITIES.canKick,
        canBan: typeof payload?.canBan === 'boolean' ? payload.canBan : DEFAULT_CAPABILITIES.canBan,
        canUnban: typeof payload?.canUnban === 'boolean' ? payload.canUnban : DEFAULT_CAPABILITIES.canUnban,
        canConsole: typeof payload?.canConsole === 'boolean' ? payload.canConsole : DEFAULT_CAPABILITIES.canConsole,
        canViewLogs: typeof payload?.canViewLogs === 'boolean' ? payload.canViewLogs : DEFAULT_CAPABILITIES.canViewLogs,
        canMessage: typeof payload?.canMessage === 'boolean' ? payload.canMessage : DEFAULT_CAPABILITIES.canMessage,
        canMute: typeof payload?.canMute === 'boolean' ? payload.canMute : DEFAULT_CAPABILITIES.canMute,
        canUnmute: typeof payload?.canUnmute === 'boolean' ? payload.canUnmute : DEFAULT_CAPABILITIES.canUnmute,
        canManageRespawn: typeof payload?.canManageRespawn === 'boolean' ? payload.canManageRespawn : DEFAULT_CAPABILITIES.canManageRespawn,
      });
    } catch {
      // silently ignore
    }
  }, []);

  const fetchBans = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/bans');
      if (!res.ok) return;
      const bans = await res.json();
      setBannedUsers(Array.isArray(bans) ? bans as BannedUserEntry[] : []);
    } catch {
      // silently ignore
    }
  }, []);

  const fetchMutes = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/mutes');
      if (!res.ok) return;
      const mutes = await res.json();
      const parsed = Array.isArray(mutes) ? mutes as MutedUserEntry[] : [];
      setMutedUsers(parsed);
    } catch {
      // silently ignore
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      if (!capabilities.canViewLogs) {
        setLogEntries([]);
        setLogHasMore(false);
        return;
      }

      const params = new URLSearchParams();
      if (logTypeFilter) params.set('type', logTypeFilter);
  if (logLevelFilter) params.set('level', logLevelFilter);
      params.set('limit', String(logLimit));
      if (logSinceMinutes) params.set('sinceMinutes', logSinceMinutes);
      if (logBeforeTs !== null) params.set('beforeTs', String(logBeforeTs));

      const res = await fetch(`/api/admin/logs?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          setLogEntries([]);
          setLogHasMore(false);
        }
        return;
      }

      const entries = await res.json();
      const parsed = Array.isArray(entries) ? entries as LogEntry[] : [];
      setLogEntries(parsed);
      setLogHasMore(parsed.length === logLimit);
    } catch {
      // silently ignore
    }
  }, [capabilities.canViewLogs, logBeforeTs, logLevelFilter, logLimit, logSinceMinutes, logTypeFilter]);

  const fetchServerConsole = useCallback(async () => {
    try {
      if (!capabilities.canViewLogs) {
        setServerConsoleEntries([]);
        return;
      }

      const res = await fetch('/api/admin/logs?type=server&limit=200');
      if (!res.ok) {
        if (res.status === 403) {
          setServerConsoleEntries([]);
        }
        return;
      }

      const entries = await res.json();
      const parsed = Array.isArray(entries) ? entries as LogEntry[] : [];
      setServerConsoleEntries(parsed.slice().reverse());
    } catch {
      // silently ignore
    }
  }, [capabilities.canViewLogs]);

  const fetchFrontendMetrics = useCallback(async () => {
    try {
      if (!capabilities.canViewLogs) {
        setMetricEntries([]);
        setMetricSummary(EMPTY_FRONTEND_METRICS_SUMMARY);
        return;
      }

      const params = new URLSearchParams();
      params.set('limit', String(metricLimit));
      if (metricSourceFilter) params.set('source', metricSourceFilter);
      if (metricNameFilter.trim()) params.set('name', metricNameFilter.trim());

      const res = await fetch(`/api/admin/frontend-metrics?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          setMetricEntries([]);
          setMetricSummary(EMPTY_FRONTEND_METRICS_SUMMARY);
        }
        return;
      }

      const payload = await res.json();
      setMetricEntries(Array.isArray(payload?.entries) ? payload.entries : []);
      setMetricSummary(payload?.summary || EMPTY_FRONTEND_METRICS_SUMMARY);
    } catch {
      // silently ignore
    }
  }, [capabilities.canViewLogs, metricLimit, metricNameFilter, metricSourceFilter]);

  const fetchClientRuntimeEvents = useCallback(async () => {
    try {
      if (!capabilities.canViewLogs) {
        setClientRuntimeEntries([]);
        setClientRuntimeSummary(EMPTY_CLIENT_RUNTIME_SUMMARY);
        return;
      }

      const params = new URLSearchParams();
      params.set('limit', String(metricLimit));

      const res = await fetch(`/api/admin/client-runtime-events?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          setClientRuntimeEntries([]);
          setClientRuntimeSummary(EMPTY_CLIENT_RUNTIME_SUMMARY);
        }
        return;
      }

      const payload = await res.json();
      setClientRuntimeEntries(Array.isArray(payload?.entries) ? payload.entries : []);
      setClientRuntimeSummary(payload?.summary || EMPTY_CLIENT_RUNTIME_SUMMARY);
    } catch {
      // silently ignore
    }
  }, [capabilities.canViewLogs, metricLimit]);

  const fetchDownedPlayers = useCallback(async () => {
    try {
      if (!capabilities.canManageRespawn) {
        setDownedPlayers([]);
        return;
      }

      const res = await fetch('/api/admin/respawn-status');
      if (!res.ok) {
        if (res.status === 403) {
          setDownedPlayers([]);
        }
        return;
      }

      const payload = await res.json();
      setDownedPlayers(Array.isArray(payload) ? payload as DownedPlayerEntry[] : []);
    } catch {
      // silently ignore
    }
  }, [capabilities.canManageRespawn]);

  const fetchRevivalEvents = useCallback(async () => {
    try {
      if (!capabilities.canViewLogs) {
        setRevivalEvents([]);
        return;
      }

      const params = new URLSearchParams();
      if (eventTypeFilter) params.set('type', eventTypeFilter);
      params.set('limit', String(eventLimit));

      const res = await fetch(`/api/admin/events?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          setRevivalEvents([]);
        }
        return;
      }

      const payload = await res.json();
      setRevivalEvents(Array.isArray(payload) ? payload as RevivalEventEntry[] : []);
    } catch {
      // silently ignore
    }
  }, [capabilities.canViewLogs, eventLimit, eventTypeFilter]);

  const mapJsonToCfgForm = useCallback((jsonText: string): CfgFormState => {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const joinAccessRaw = parsed.joinAccess && typeof parsed.joinAccess === 'object'
      ? parsed.joinAccess as Record<string, unknown>
      : {};
    const discordBotRaw = parsed.discordBot && typeof parsed.discordBot === 'object'
      ? parsed.discordBot as Record<string, unknown>
      : {};
    const startSpawnRaw = parsed.startSpawn && typeof parsed.startSpawn === 'object'
      ? parsed.startSpawn as Record<string, unknown>
      : {};
    const startSpawnPos = Array.isArray(startSpawnRaw.pos) ? startSpawnRaw.pos as unknown[] : [];
    const npcSettingsRaw = parsed.npcSettings && typeof parsed.npcSettings === 'object'
      ? parsed.npcSettings as Record<string, unknown>
      : {};
    const npcDefaultSettingsRaw = npcSettingsRaw.default && typeof npcSettingsRaw.default === 'object'
      ? npcSettingsRaw.default as Record<string, unknown>
      : {};
    const starterInventoryRaw = parsed.starterInventory && typeof parsed.starterInventory === 'object'
      ? parsed.starterInventory as Record<string, unknown>
      : {};

    const entriesRaw = Array.isArray(starterInventoryRaw.entries) ? starterInventoryRaw.entries : [];
    const starterInventory = entriesRaw
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const typed = entry as Record<string, unknown>;
        const baseId = Number(typed.baseId);
        const count = Number(typed.count);
        if (!Number.isFinite(baseId) || !Number.isFinite(count)) return null;
        return {
          baseId: Math.max(0, Math.floor(baseId)),
          count: Math.max(1, Math.floor(count)),
          worn: Boolean(typed.worn),
          wornLeft: Boolean(typed.wornLeft),
        } as StarterInventoryRow;
      })
      .filter((row): row is StarterInventoryRow => row !== null);

    return {
      serverName: String(parsed.name || ''),
      port: Number.isFinite(Number(parsed.port)) ? Math.max(1, Math.floor(Number(parsed.port))) : 7777,
      maxPlayers: Number.isFinite(Number(parsed.maxPlayers)) ? Math.max(1, Math.floor(Number(parsed.maxPlayers))) : 100,
      offlineMode: Boolean(parsed.offlineMode),
      defaultLanguage: String((parsed.localeRouting as Record<string, unknown> | undefined)?.defaultLanguage || 'en'),
      startSpawn: {
        x: Number.isFinite(Number(startSpawnPos[0])) ? Number(startSpawnPos[0]) : DEFAULT_CFG_FORM.startSpawn.x,
        y: Number.isFinite(Number(startSpawnPos[1])) ? Number(startSpawnPos[1]) : DEFAULT_CFG_FORM.startSpawn.y,
        z: Number.isFinite(Number(startSpawnPos[2])) ? Number(startSpawnPos[2]) : DEFAULT_CFG_FORM.startSpawn.z,
        worldOrCell: String(startSpawnRaw.worldOrCell || DEFAULT_CFG_FORM.startSpawn.worldOrCell),
        angleZ: Number.isFinite(Number(startSpawnRaw.angleZ)) ? Number(startSpawnRaw.angleZ) : DEFAULT_CFG_FORM.startSpawn.angleZ,
      },
      npcEnabled: Boolean(parsed.npcEnabled),
      npcDefaultSettings: {
        spawnInInterior: npcDefaultSettingsRaw.spawnInInterior === undefined
          ? DEFAULT_CFG_FORM.npcDefaultSettings.spawnInInterior
          : Boolean(npcDefaultSettingsRaw.spawnInInterior),
        spawnInExterior: npcDefaultSettingsRaw.spawnInExterior === undefined
          ? DEFAULT_CFG_FORM.npcDefaultSettings.spawnInExterior
          : Boolean(npcDefaultSettingsRaw.spawnInExterior),
        allowHumanoid: npcDefaultSettingsRaw.allowHumanoid === undefined
          ? DEFAULT_CFG_FORM.npcDefaultSettings.allowHumanoid
          : Boolean(npcDefaultSettingsRaw.allowHumanoid),
        allowCreature: npcDefaultSettingsRaw.allowCreature === undefined
          ? DEFAULT_CFG_FORM.npcDefaultSettings.allowCreature
          : Boolean(npcDefaultSettingsRaw.allowCreature),
      },
      joinAccess: {
        mode: (['none', 'approvedLicense', 'discordMember', 'discordRoles'].includes(String(joinAccessRaw.mode))
          ? String(joinAccessRaw.mode)
          : 'none') as JoinAccessForm['mode'],
        rejectionMessage: String(joinAccessRaw.rejectionMessage || DEFAULT_CFG_FORM.joinAccess.rejectionMessage),
        approvedLicenses: Array.isArray(joinAccessRaw.approvedLicenses) ? joinAccessRaw.approvedLicenses.map((v) => String(v)).join(', ') : '',
        approvedDiscordIds: Array.isArray(joinAccessRaw.approvedDiscordIds) ? joinAccessRaw.approvedDiscordIds.map((v) => String(v)).join(', ') : '',
        discordRoleIds: Array.isArray(joinAccessRaw.discordRoleIds) ? joinAccessRaw.discordRoleIds.map((v) => String(v)).join(', ') : '',
      },
      discordBot: {
        enabled: Boolean(discordBotRaw.enabled),
        token: String(discordBotRaw.token || ''),
        guildId: String(discordBotRaw.guildId || ''),
        warningsChannelId: String(discordBotRaw.warningsChannelId || ''),
      },
      starterInventory,
    };
  }, []);

  const mergeCfgFormIntoJson = useCallback((rawJsonText: string, form: CfgFormState): string => {
    const parsed = JSON.parse(rawJsonText) as Record<string, unknown>;
    parsed.name = form.serverName.trim() || parsed.name || DEFAULT_CFG_FORM.serverName;
    parsed.port = Math.max(1, Math.floor(Number(form.port) || 7777));
    parsed.maxPlayers = Math.max(1, Math.floor(Number(form.maxPlayers) || 100));
    parsed.offlineMode = Boolean(form.offlineMode);

    const localeRouting = parsed.localeRouting && typeof parsed.localeRouting === 'object'
      ? parsed.localeRouting as Record<string, unknown>
      : {};
    localeRouting.defaultLanguage = form.defaultLanguage.trim() || 'en';
    parsed.localeRouting = localeRouting;

    const normalizedStartSpawn = {
      pos: [
        Number(form.startSpawn.x) || 0,
        Number(form.startSpawn.y) || 0,
        Number(form.startSpawn.z) || 0,
      ],
      worldOrCell: form.startSpawn.worldOrCell.trim() || DEFAULT_CFG_FORM.startSpawn.worldOrCell,
      angleZ: Number(form.startSpawn.angleZ) || 0,
    };

    parsed.startSpawn = normalizedStartSpawn;
    parsed.startPoints = [normalizedStartSpawn];

    const npcSettings = parsed.npcSettings && typeof parsed.npcSettings === 'object'
      ? parsed.npcSettings as Record<string, unknown>
      : {};
    const npcDefaultSettings = npcSettings.default && typeof npcSettings.default === 'object'
      ? npcSettings.default as Record<string, unknown>
      : {};
    npcDefaultSettings.spawnInInterior = Boolean(form.npcDefaultSettings.spawnInInterior);
    npcDefaultSettings.spawnInExterior = Boolean(form.npcDefaultSettings.spawnInExterior);
    npcDefaultSettings.allowHumanoid = Boolean(form.npcDefaultSettings.allowHumanoid);
    npcDefaultSettings.allowCreature = Boolean(form.npcDefaultSettings.allowCreature);
    npcSettings.default = npcDefaultSettings;
    parsed.npcEnabled = Boolean(form.npcEnabled);
    parsed.npcSettings = npcSettings;

    parsed.joinAccess = {
      mode: form.joinAccess.mode,
      rejectionMessage: form.joinAccess.rejectionMessage.trim() || DEFAULT_CFG_FORM.joinAccess.rejectionMessage,
      approvedLicenses: parseCommaList(form.joinAccess.approvedLicenses),
      approvedDiscordIds: parseCommaList(form.joinAccess.approvedDiscordIds),
      discordRoleIds: parseCommaList(form.joinAccess.discordRoleIds),
    };

    parsed.discordBot = {
      enabled: form.discordBot.enabled,
      token: form.discordBot.token.trim(),
      guildId: form.discordBot.guildId.trim(),
      warningsChannelId: form.discordBot.warningsChannelId.trim(),
    };

    parsed.discordAuth = {
      ...(parsed.discordAuth && typeof parsed.discordAuth === 'object' ? parsed.discordAuth as Record<string, unknown> : {}),
      botToken: form.discordBot.token.trim(),
      guildId: form.discordBot.guildId.trim(),
      eventLogChannelId: form.discordBot.warningsChannelId.trim(),
    };

    parsed.starterInventory = {
      entries: form.starterInventory.map((entry) => ({
        baseId: Math.max(0, Math.floor(entry.baseId)),
        count: Math.max(1, Math.floor(entry.count)),
        ...(entry.worn ? { worn: true } : {}),
        ...(entry.wornLeft ? { wornLeft: true } : {}),
      })),
    };

    return JSON.stringify(parsed, null, 2);
  }, []);

  const addStarterInventoryEntry = useCallback(() => {
    const code = inventoryCustomCode.trim() || inventoryItemCode;
    const baseId = parseItemCodeToBaseId(code);
    if (baseId === null) {
      setCfgEditorStatus(t('adminDashboard.cfgInvalidItemCode'));
      return;
    }

    setCfgForm((prev) => ({
      ...prev,
      starterInventory: [
        ...prev.starterInventory,
        {
          baseId,
          count: Math.max(1, Math.floor(Number(inventoryCount) || 1)),
          worn: inventoryWorn,
          wornLeft: inventoryWornLeft,
        },
      ],
    }));
    setInventoryCustomCode('');
    setInventoryCount(1);
    setInventoryWorn(false);
    setInventoryWornLeft(false);
  }, [inventoryCount, inventoryCustomCode, inventoryItemCode, inventoryWorn, inventoryWornLeft, t]);

  const removeStarterInventoryEntry = useCallback((index: number) => {
    setCfgForm((prev) => ({
      ...prev,
      starterInventory: prev.starterInventory.filter((_, currentIndex) => currentIndex !== index),
    }));
  }, []);

  const loadCfgEditor = useCallback(async () => {
    setCfgEditorLoading(true);
    try {
      const res = await fetch('/api/admin/cfg/server-settings');
      if (!res.ok) {
        if (res.status === 403) {
          setCfgEditorStatus(t('adminDashboard.noPermission'));
        } else {
          setCfgEditorStatus(t('adminDashboard.apiError'));
        }
        return;
      }
      const payload = await res.json();
      const text = typeof payload?.json === 'string' ? payload.json : JSON.stringify(payload ?? {}, null, 2);
      setCfgEditorText(text);
      try {
        setCfgForm(mapJsonToCfgForm(text));
      } catch {
        setCfgForm(DEFAULT_CFG_FORM);
      }
      const pathText = typeof payload?.path === 'string' && payload.path.length > 0 ? `: ${payload.path}` : '';
      setCfgEditorStatus(`${t('adminDashboard.cfgLoaded')}${pathText}`);
    } catch {
      setCfgEditorStatus(t('adminDashboard.apiError'));
    } finally {
      setCfgEditorLoading(false);
    }
  }, [mapJsonToCfgForm, t]);

  const formatCfgEditor = useCallback(() => {
    try {
      const parsed = JSON.parse(cfgEditorText);
      const formatted = JSON.stringify(parsed, null, 2);
      setCfgEditorText(formatted);
      setCfgForm(mapJsonToCfgForm(formatted));
      setCfgEditorStatus(t('adminDashboard.cfgFormatted'));
    } catch {
      setCfgEditorStatus(t('adminDashboard.cfgInvalidJson'));
    }
  }, [cfgEditorText, mapJsonToCfgForm, t]);

  const applyAccessDiscordToCfgEditor = useCallback(() => {
    try {
      const parsed = JSON.parse(cfgEditorText);
      const next = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};

      const normalizeJoinMode = (value: unknown): 'none' | 'approvedLicense' | 'discordMember' | 'discordRoles' => {
        const mode = String(value || '').trim();
        if (mode === 'approvedLicense' || mode === 'discordMember' || mode === 'discordRoles') return mode;
        return 'none';
      };

      const asStringArray = (value: unknown): string[] => {
        if (!Array.isArray(value)) return [];
        return value.map((item) => String(item || '').trim()).filter((item) => item.length > 0);
      };

      const joinAccessRaw = next.joinAccess && typeof next.joinAccess === 'object'
        ? next.joinAccess as Record<string, unknown>
        : {};
      const discordBotRaw = next.discordBot && typeof next.discordBot === 'object'
        ? next.discordBot as Record<string, unknown>
        : {};
      const discordAuthRaw = next.discordAuth && typeof next.discordAuth === 'object'
        ? next.discordAuth as Record<string, unknown>
        : {};

      const joinAccess = {
        mode: normalizeJoinMode(joinAccessRaw.mode),
        rejectionMessage: String(joinAccessRaw.rejectionMessage || 'Access denied. Please contact server staff for whitelist approval.'),
        approvedLicenses: asStringArray(joinAccessRaw.approvedLicenses),
        approvedDiscordIds: asStringArray(joinAccessRaw.approvedDiscordIds),
        discordRoleIds: asStringArray(joinAccessRaw.discordRoleIds),
      };

      const discordBot = {
        enabled: Boolean(discordBotRaw.enabled),
        token: String(discordBotRaw.token || discordAuthRaw.botToken || ''),
        guildId: String(discordBotRaw.guildId || discordAuthRaw.guildId || ''),
        warningsChannelId: String(discordBotRaw.warningsChannelId || discordAuthRaw.eventLogChannelId || ''),
      };

      next.joinAccess = joinAccess;
      next.discordBot = discordBot;
      next.discordAuth = {
        ...discordAuthRaw,
        botToken: discordBot.token,
        guildId: discordBot.guildId,
        eventLogChannelId: discordBot.warningsChannelId,
      };

      const normalized = JSON.stringify(next, null, 2);
      setCfgEditorText(normalized);
      setCfgForm(mapJsonToCfgForm(normalized));
      setCfgEditorStatus(t('adminDashboard.accessApplied'));
      return normalized;
    } catch {
      setCfgEditorStatus(t('adminDashboard.cfgInvalidJson'));
      return null;
    }
  }, [cfgEditorText, mapJsonToCfgForm, t]);

  const saveCfgEditor = useCallback(async (preparedJson?: string) => {
    let normalized: string;
    try {
      normalized = mergeCfgFormIntoJson(preparedJson ?? cfgEditorText, cfgForm);
    } catch {
      setCfgEditorStatus(t('adminDashboard.cfgInvalidJson'));
      return;
    }

    setCfgEditorSaving(true);
    try {
      const res = await fetch('/api/admin/cfg/server-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: normalized }),
      });
      if (!res.ok) {
        if (res.status === 403) {
          setCfgEditorStatus(t('adminDashboard.noPermission'));
        } else {
          const text = await res.text().catch(() => '');
          setCfgEditorStatus(`${t('adminDashboard.apiError')}${text ? `: ${text.slice(0, 120)}` : ''}`);
        }
        return;
      }
      const nextLanguage = detectLanguage(cfgForm.defaultLanguage);
      setCfgEditorText(normalized);
      setCfgForm(mapJsonToCfgForm(normalized));
      persistRuntimeLanguage(nextLanguage);
      if (i18n.resolvedLanguage !== nextLanguage) {
        await i18n.changeLanguage(nextLanguage);
      }
      setCfgEditorStatus(i18n.getFixedT(nextLanguage)('adminDashboard.cfgSaved'));
    } catch {
      setCfgEditorStatus(t('adminDashboard.apiError'));
    } finally {
      setCfgEditorSaving(false);
    }
  }, [cfgEditorText, cfgForm, i18n, mapJsonToCfgForm, mergeCfgFormIntoJson, t]);

  const revivePlayer = useCallback(async (userId: number) => {
    const reason = moderationReason.trim();
    try {
      const res = await fetch('/api/admin/revive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reason ? { userId, reason } : { userId }),
      });
      setForbiddenAwareStatus(res, `${t('adminDashboard.revived')}: ${userId}`);
      if (res.ok) {
        await fetchDownedPlayers();
        await fetchRevivalEvents();
      }
    } catch {
      setStatusMsg(t('adminDashboard.apiError'));
    }
  }, [fetchDownedPlayers, fetchRevivalEvents, moderationReason, setForbiddenAwareStatus, t]);

  const kickPlayer = async (userId: number) => {
    const reason = moderationReason.trim();
    try {
      const res = await fetch(`/api/admin/players/${userId}/kick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reason ? { reason } : {}),
      });
      setForbiddenAwareStatus(res, `${t('adminDashboard.kicked')}: ${userId}`);
      if (res.ok) await fetchData();
    } catch {
      setStatusMsg(t('adminDashboard.apiError'));
    }
  };

  const banPlayer = async (userId: number) => {
    if (!window.confirm(`${t('adminDashboard.banConfirm')} userId=${userId}?`)) return;
    const reason = moderationReason.trim();
    try {
      const body: Record<string, unknown> = { durationMinutes: banDurationMinutes };
      if (reason) body.reason = reason;
      const res = await fetch(`/api/admin/players/${userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setForbiddenAwareStatus(res, `${t('adminDashboard.banned')}: ${userId}`);
      if (res.ok) {
        await fetchData();
        await fetchBans();
      }
    } catch {
      setStatusMsg(t('adminDashboard.apiError'));
    }
  };

  const unbanPlayer = async (userId: number) => {
    if (!window.confirm(`${t('adminDashboard.unbanConfirm')} userId=${userId}?`)) return;
    try {
      const res = await fetch(`/api/admin/players/${userId}/ban`, { method: 'DELETE' });
      setForbiddenAwareStatus(res, `${t('adminDashboard.unbanned')}: ${userId}`);
      if (res.ok) await fetchBans();
    } catch {
      setStatusMsg(t('adminDashboard.apiError'));
    }
  };

  const sendMessageToPlayer = async () => {
    if (sendMsgTargetId === null || !capabilities.canMessage) return;
    const text = sendMsgText.trim();
    const reason = moderationReason.trim();
    if (!text) return;
    setSendMsgSending(true);
    try {
      const res = await fetch(`/api/admin/players/${sendMsgTargetId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reason ? { message: text, reason } : { message: text }),
      });
      setForbiddenAwareStatus(res, t('adminDashboard.messageSent'));
      if (res.ok) {
        setSendMsgTargetId(null);
        setSendMsgText('');
        setModerationReason('');
      }
    } catch {
      setStatusMsg(t('adminDashboard.apiError'));
    } finally {
      setSendMsgSending(false);
    }
  };

  const kickAllPlayers = async () => {
    if (!capabilities.canKick || players.length === 0) return;
    if (!window.confirm(`${t('adminDashboard.kickAllConfirm')} (${players.length})?`)) return;

    const reason = moderationReason.trim();
    setSidebarActionSending('kick-all');
    try {
      const res = await fetch('/api/admin/players/kick-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reason ? { reason } : {}),
      });
      setForbiddenAwareStatus(res, `${t('adminDashboard.kickAllPlayers')}: ${players.length}`);
      if (res.ok) {
        await fetchData();
      }
    } catch {
      setStatusMsg(t('adminDashboard.apiError'));
    } finally {
      setSidebarActionSending(null);
    }
  };

  const sendAnnouncement = async () => {
    if (!capabilities.canMessage) return;
    const message = window.prompt(t('adminDashboard.announcementPrompt'))?.trim() ?? '';
    if (!message) return;

    const reason = moderationReason.trim();
    setSidebarActionSending('announcement');
    try {
      const body: Record<string, unknown> = { message };
      if (reason) body.reason = reason;
      const res = await fetch('/api/admin/announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setForbiddenAwareStatus(res, t('adminDashboard.announcementSent'));
      if (res.ok) {
        setModerationReason('');
      }
    } catch {
      setStatusMsg(t('adminDashboard.apiError'));
    } finally {
      setSidebarActionSending(null);
    }
  };

  const mutePlayer = async (userId: number) => {
    if (!capabilities.canMute) return;
    const reason = moderationReason.trim();
    try {
      const res = await fetch(`/api/admin/players/${userId}/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reason ? { durationMinutes: muteDurationMinutes, reason } : { durationMinutes: muteDurationMinutes }),
      });
      setForbiddenAwareStatus(res, `${t('adminDashboard.muted')}: ${userId}`);
      if (res.ok) await fetchMutes();
    } catch {
      setStatusMsg(t('adminDashboard.apiError'));
    }
  };

  const unmutePlayer = async (userId: number) => {
    if (!window.confirm(`${t('adminDashboard.unmuteConfirm')} userId=${userId}?`)) return;
    try {
      const res = await fetch(`/api/admin/players/${userId}/mute`, { method: 'DELETE' });
      setForbiddenAwareStatus(res, `${t('adminDashboard.unmuted')}: ${userId}`);
      if (res.ok) await fetchMutes();
    } catch {
      setStatusMsg(t('adminDashboard.apiError'));
    }
  };

  const sendConsoleCommand = async () => {
    if (!capabilities.canConsole) return;

    const cmd = consoleInput.trim();
    if (!cmd) return;

    setConsoleHistory((prev) => {
      const next = [cmd, ...prev.filter((entry) => entry !== cmd)];
      return next.slice(0, 30);
    });
    setConsoleHistoryIndex(null);

    setConsoleLines((prev) => [...prev, { text: `> ${cmd}`, kind: 'input' }]);
    setConsoleInput('');
    setConsoleSending(true);

    try {
      const res = await fetch('/api/admin/console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });

      const payload = await res.json().catch(() => ({} as Record<string, unknown>));
      const resultText = typeof payload.resultText === 'string' ? payload.resultText : '';
      const errorText = typeof payload.error === 'string' ? payload.error : '';

      if (res.ok) {
        const msg = resultText
          ? `${t('adminDashboard.consoleResult')}: ${resultText}`
          : t('adminDashboard.consoleSent');
        setConsoleLines((prev) => [...prev, { text: msg, kind: 'ok' }]);
        void fetchServerConsole();
      } else if (res.status === 403) {
        setConsoleLines((prev) => [...prev, { text: t('adminDashboard.noPermission'), kind: 'err' }]);
      } else {
        const msg = errorText
          ? `${t('adminDashboard.consoleError')}: ${errorText}`
          : t('adminDashboard.apiError');
        setConsoleLines((prev) => [...prev, { text: msg, kind: 'err' }]);
      }
    } catch {
      setConsoleLines((prev) => [...prev, { text: t('adminDashboard.apiError'), kind: 'err' }]);
    } finally {
      setConsoleSending(false);
    }
  };

  const handleConsoleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      void sendConsoleCommand();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (consoleHistory.length === 0) return;
      const nextIndex = consoleHistoryIndex === null
        ? 0
        : Math.min(consoleHistoryIndex + 1, consoleHistory.length - 1);
      setConsoleHistoryIndex(nextIndex);
      setConsoleInput(consoleHistory[nextIndex]);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (consoleHistoryIndex === null) return;
      const nextIndex = consoleHistoryIndex - 1;
      if (nextIndex < 0) {
        setConsoleHistoryIndex(null);
        setConsoleInput('');
      } else {
        setConsoleHistoryIndex(nextIndex);
        setConsoleInput(consoleHistory[nextIndex]);
      }
    }
  };

  const show = useCallback(async () => {
    setVisible(true);
    setLoading(true);
    await Promise.all([fetchData(), fetchCapabilities(), fetchBans()]);
    setLoading(false);
    intervalRef.current = setInterval(fetchData, REFRESH_INTERVAL_MS);
  }, [fetchBans, fetchCapabilities, fetchData]);

  const hide = useCallback(() => {
    setVisible(false);
    setStatus(null);
    setPlayers([]);
    setBannedUsers([]);
    setMutedUsers([]);
    setStatusMsg('');
    setConsoleLines([]);
    setConsoleHistoryIndex(null);
    setServerConsoleEntries([]);
    setLogEntries([]);
    setLogBeforeTs(null);
    setLogHasMore(false);
    setMetricEntries([]);
    setMetricSummary(EMPTY_FRONTEND_METRICS_SUMMARY);
    setClientRuntimeEntries([]);
    setClientRuntimeSummary(EMPTY_CLIENT_RUNTIME_SUMMARY);
    setDownedPlayers([]);
    setRevivalEvents([]);
    setSendMsgTargetId(null);
    setSendMsgText('');
    setModerationReason('');
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const onShow = () => void show();
    const onHide = () => hide();

    window.addEventListener('showAdminDashboard', onShow);
    window.addEventListener('hideAdminDashboard', onHide);

    // Dev/test shortcut: open admin directly via URL (?admin=1 or #admin)
    const params = new URLSearchParams(window.location.search);
    const shouldAutoOpen = params.get('admin') === '1' || window.location.hash === '#admin';
    if (shouldAutoOpen) {
      void show();
    }

    return () => {
      window.removeEventListener('showAdminDashboard', onShow);
      window.removeEventListener('hideAdminDashboard', onHide);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [hide, show]);

  useEffect(() => {
    if (!visible) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        hide();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hide, visible]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('adminDashboardVisibility', { detail: { visible } }));
  }, [visible]);

  useEffect(() => {
    if (consoleEndRef.current) consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLines, serverConsoleEntries]);

  useEffect(() => {
    if (activeTab === 'console') void fetchServerConsole();
    if (activeTab === 'logs') void fetchLogs();
    if (activeTab === 'metrics') void fetchFrontendMetrics();
    if (activeTab === 'metrics') void fetchClientRuntimeEvents();
    if (activeTab === 'respawn') void fetchDownedPlayers();
    if (activeTab === 'events') void fetchRevivalEvents();
    if (activeTab === 'cfg') void loadCfgEditor();
  }, [activeTab, fetchClientRuntimeEvents, fetchDownedPlayers, fetchFrontendMetrics, fetchLogs, fetchRevivalEvents, fetchServerConsole, loadCfgEditor]);

  useEffect(() => {
    if (!visible || activeTab !== 'console') return;
    const id = setInterval(() => {
      void fetchServerConsole();
    }, 2000);
    return () => clearInterval(id);
  }, [activeTab, fetchServerConsole, visible]);

  useEffect(() => {
    if (!visible || activeTab !== 'logs') return;
    const id = setInterval(() => {
      void fetchLogs();
    }, 2000);
    return () => clearInterval(id);
  }, [activeTab, fetchLogs, visible]);

  useEffect(() => {
    if (!visible || activeTab !== 'respawn') return;
    const id = setInterval(() => {
      void fetchDownedPlayers();
      setNowTs(Date.now());
    }, 2000);
    return () => clearInterval(id);
  }, [activeTab, fetchDownedPlayers, visible]);

  useEffect(() => {
    if (!visible || activeTab !== 'events') return;
    const id = setInterval(() => {
      void fetchRevivalEvents();
    }, 2000);
    return () => clearInterval(id);
  }, [activeTab, fetchRevivalEvents, visible]);

  useEffect(() => {
    setLogBeforeTs(null);
  }, [logLevelFilter, logTypeFilter, logLimit, logSinceMinutes]);

  useEffect(() => {
    if (activeTab === 'players' && (capabilities.canBan || capabilities.canUnban || capabilities.canMute || capabilities.canUnmute)) {
      void fetchBans();
      void fetchMutes();
    }
  }, [activeTab, capabilities.canBan, capabilities.canMute, capabilities.canUnban, capabilities.canUnmute, fetchBans, fetchMutes]);

  useEffect(() => {
    if (!visible || activeTab !== 'players' || !(capabilities.canMute || capabilities.canUnmute)) return;
    const id = setInterval(() => {
      void fetchMutes();
    }, 15000);
    return () => clearInterval(id);
  }, [activeTab, capabilities.canMute, capabilities.canUnmute, fetchMutes, visible]);

  const hasTimedBans = bannedUsers.some((b) => !b.permanent);
  useEffect(() => {
    if (!visible || activeTab !== 'players' || (mutedUsers.length === 0 && !hasTimedBans)) return;
    const id = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [activeTab, hasTimedBans, mutedUsers.length, visible]);

  const metricSourceOptions = useMemo(() => metricSummary.sources.map((item) => item.name), [metricSummary.sources]);
  const filteredCatalogItems = useMemo(
    () => ITEM_CATALOG.filter((item) => item.category === inventoryCategory),
    [inventoryCategory],
  );
  const selectedSpawnPresetKey = useMemo(
    () => SPAWN_PRESETS.find((preset) => matchesSpawnPreset(cfgForm.startSpawn, preset))?.key ?? '',
    [cfgForm.startSpawn],
  );
  const selectedWorldOrCellValue = useMemo(() => {
    const normalizedValue = normalizeWorldOrCell(cfgForm.startSpawn.worldOrCell);
    return WORLD_OR_CELL_OPTIONS.some((option) => option.value === normalizedValue)
      ? normalizedValue
      : '__custom__';
  }, [cfgForm.startSpawn.worldOrCell]);
  const worldOrCellHintKey = useMemo(
    () => WORLD_OR_CELL_HINTS[normalizeWorldOrCell(cfgForm.startSpawn.worldOrCell)] ?? 'cfgWorldOrCellHint_custom',
    [cfgForm.startSpawn.worldOrCell],
  );
  const catalogNameByBaseId = useMemo(
    () => new Map(ITEM_CATALOG.map((item) => [parseInt(item.codeHex, 16), item.name] as const)),
    [],
  );

  useEffect(() => {
    if (filteredCatalogItems.length === 0) return;
    setInventoryItemCode(filteredCatalogItems[0].codeHex);
  }, [filteredCatalogItems]);

  const filteredPlayers = filterAdminPlayers(players, playerSearch);
  const oldestLogTs = logEntries.length > 0 ? logEntries[logEntries.length - 1].ts : null;
  const activeMutedUsers = useMemo(
    () => mutedUsers
      .filter((entry) => entry.expiresAt > nowTs)
      .sort((left, right) => left.expiresAt - right.expiresAt),
    [mutedUsers, nowTs],
  );
  const activeMuteByUserId = useMemo(
    () => new Map(activeMutedUsers.map((entry) => [entry.userId, entry] as const)),
    [activeMutedUsers],
  );
  const activeBannedUsers = useMemo(
    () => bannedUsers
      .filter((entry) => entry.permanent || (entry.expiresAt !== null && entry.expiresAt > nowTs))
      .sort((a, b) => {
        if (a.permanent !== b.permanent) return a.permanent ? 1 : -1; // timed first
        if (!a.permanent && !b.permanent) return (a.expiresAt ?? 0) - (b.expiresAt ?? 0);
        return a.userId - b.userId;
      }),
    [bannedUsers, nowTs],
  );
  const activeBanByUserId = useMemo(
    () => new Map(activeBannedUsers.map((entry) => [entry.userId, entry] as const)),
    [activeBannedUsers],
  );

  const openOlderLogs = () => {
    if (!oldestLogTs) return;
    setLogBeforeTs(oldestLogTs);
  };

  const openRecentLogs = () => {
    setLogBeforeTs(null);
  };

  const resetDashboardPreferences = () => {
    setActiveTab('overview');
    setPlayerSearch('');
    setLogTypeFilter('');
    setLogLevelFilter('');
    setLogLimit(100);
    setLogSinceMinutes('');
    setLogBeforeTs(null);
    setMetricLimit(50);
    setMetricSourceFilter('');
    setMetricNameFilter('');
    setConsoleHistory([]);
    setConsoleHistoryIndex(null);
    setCfgEditorStatus('');
    setCfgEditorTab('general');
    setStatusMsg(t('adminDashboard.preferencesReset'));
    try {
      window.localStorage.removeItem(ADMIN_DASHBOARD_STATE_KEY);
    } catch {
      // ignore storage remove failures
    }
  };

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'overview', label: t('adminDashboard.tabOverview') },
    { key: 'players', label: t('adminDashboard.tabPlayers') },
    { key: 'console', label: t('adminDashboard.tabConsole') },
    { key: 'logs', label: t('adminDashboard.tabLogs') },
    { key: 'metrics', label: t('adminDashboard.tabMetrics') },
    { key: 'cfg', label: t('adminDashboard.tabCfg') },
    { key: 'respawn', label: t('adminDashboard.tabRespawn') },
    { key: 'events', label: t('adminDashboard.tabEvents') },
  ];

  const defaultTabByTopSection: Record<TopSection, Tab> = {
    players: 'players',
    history: 'logs',
    playerDrops: 'events',
    whitelist: 'respawn',
    admins: 'console',
    settings: 'overview',
    system: 'metrics',
  };

  const topNavItems: Array<{ key: TopSection; label: string }> = [
    { key: 'players', label: t('adminDashboard.topTx_players') },
    { key: 'history', label: t('adminDashboard.topTx_history') },
    { key: 'playerDrops', label: t('adminDashboard.topTx_playerDrops') },
    { key: 'whitelist', label: t('adminDashboard.topTx_whitelist') },
    { key: 'admins', label: t('adminDashboard.topTx_admins') },
    { key: 'settings', label: t('adminDashboard.topTx_settings') },
    { key: 'system', label: t('adminDashboard.topTx_system') },
  ];

  const capabilityRows: Array<{ key: keyof AdminCapabilities; label: string }> = [
    { key: 'canKick', label: t('adminDashboard.capability_kick') },
    { key: 'canBan', label: t('adminDashboard.capability_ban') },
    { key: 'canUnban', label: t('adminDashboard.capability_unban') },
    { key: 'canConsole', label: t('adminDashboard.capability_console') },
    { key: 'canViewLogs', label: t('adminDashboard.capability_logs') },
    { key: 'canMessage', label: t('adminDashboard.capability_message') },
    { key: 'canMute', label: t('adminDashboard.capability_mute') },
    { key: 'canUnmute', label: t('adminDashboard.capability_unmute') },
    { key: 'canManageRespawn', label: t('adminDashboard.capability_manageRespawn') },
  ];

  const sideNavItems: Array<{ key: Tab; label: string }> = [
    { key: 'overview', label: t('adminDashboard.sideTx_dashboard') },
    { key: 'console', label: t('adminDashboard.sideTx_liveConsole') },
    { key: 'metrics', label: t('adminDashboard.sideTx_resources') },
    { key: 'logs', label: t('adminDashboard.sideTx_serverLog') },
    { key: 'cfg', label: t('adminDashboard.sideTx_cfgEditor') },
    { key: 'respawn', label: t('adminDashboard.sideTx_respawnCenter') },
    { key: 'events', label: t('adminDashboard.sideTx_revivalJournal') },
  ];
  const currentTabLabel = tabs.find((tab) => tab.key === activeTab)?.label ?? t('adminDashboard.title');
  const summaryCards = [
    { label: t('adminDashboard.online'), value: String(status?.online ?? 0), accent: true },
    { label: t('adminDashboard.bannedUsers'), value: String(activeBannedUsers.length) },
    { label: t('adminDashboard.mutedUsers'), value: String(activeMutedUsers.length) },
    { label: t('adminDashboard.tabRespawn'), value: String(downedPlayers.length) },
  ];
  const visibleRailPlayers = filteredPlayers.slice(0, 12);

  if (!visible) return <></>;

  return (
    <div className="admin-overlay" role="dialog" aria-modal="true" aria-label={t('adminDashboard.title')}>
      <div className="admin-dashboard">
        <div className="admin-dashboard__topbar">
          <div className="admin-dashboard__brand">
            <div className="admin-dashboard__brand-mark">SK</div>
            <div className="admin-dashboard__brand-text">
              <h1 className="admin-dashboard__title">{t('adminDashboard.title')}</h1>
              <p className="admin-dashboard__subtitle">{status?.name || t('adminDashboard.subtitle')}</p>
            </div>
          </div>

          <div className="admin-dashboard__topnav" role="tablist" aria-label={t('adminDashboard.title')}>
            {topNavItems.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                id={`admin-top-tab-${key}`}
                data-testid={`admin-top-tab-${key}`}
                role="tab"
                aria-selected={activeTopSection === key}
                aria-controls={`admin-panel-${defaultTabByTopSection[key]}`}
                className={`admin-dashboard__topnav-item${activeTopSection === key ? ' admin-dashboard__topnav-item--active' : ''}`}
                onClick={() => setActiveTopSection(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="admin-dashboard__topbar-meta">
            <span className={`admin-dashboard__role admin-dashboard__role--${adminRole}`}>
              {adminUser || t(`adminDashboard.role_${adminRole}`)}
            </span>
            <FrameButton name="closeAdmin" text={t('adminDashboard.exit')} variant="DEFAULT" width={112} height={40} onClick={hide} />
          </div>
        </div>

        <div className="admin-dashboard__chrome">
          <aside className="admin-dashboard__sidebar">
            <div className="admin-dashboard__sidebar-card admin-dashboard__sidebar-card--brand">
              <div className="admin-dashboard__server-name">{status?.name || 'SkyMP'}</div>
              <div className="admin-dashboard__server-meta">{t('adminDashboard.role')}: {t(`adminDashboard.role_${adminRole}`)}</div>
            </div>

            <div className="admin-dashboard__sidebar-card">
              <div className="admin-dashboard__nav-list">
                {sideNavItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    id={`admin-tab-${item.key}`}
                    data-testid={`admin-tab-${item.key}`}
                    className={`admin-dashboard__nav-item${activeTab === item.key ? ' admin-dashboard__nav-item--active' : ''}`}
                    onClick={() => setActiveTab(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-dashboard__sidebar-card">
              <div className="admin-dashboard__sidebar-status-row">
                <span className="admin-dashboard__sidebar-status-key">{t('adminDashboard.online')}</span>
                <span className={`admin-dashboard__sidebar-pill${status ? ' admin-dashboard__sidebar-pill--online' : ''}`}>
                  {status ? t('adminDashboard.online') : t('adminDashboard.loading')}
                </span>
              </div>
              <div className="admin-dashboard__sidebar-status-row">
                <span className="admin-dashboard__sidebar-status-key">{t('adminDashboard.uptime')}</span>
                <span className="admin-dashboard__sidebar-pill">{status ? formatAdminUptime(status.uptimeSec) : '-'}</span>
              </div>
              <div className="admin-dashboard__sidebar-status-row">
                <span className="admin-dashboard__sidebar-status-key">{t('adminDashboard.port')}</span>
                <span className="admin-dashboard__sidebar-pill">{status?.port ?? '-'}</span>
              </div>
              <div className="admin-dashboard__sidebar-status-row">
                <span className="admin-dashboard__sidebar-status-key">{t('adminDashboard.players')}</span>
                <span className="admin-dashboard__sidebar-pill">{status ? `${status.online}/${status.maxPlayers}` : '0'}</span>
              </div>
            </div>

            <div className="admin-dashboard__sidebar-card admin-dashboard__sidebar-card--actions">
              <div className="admin-dashboard__sidebar-section-title">{t('adminDashboard.sidebarActionsTitle')}</div>
              <div className="admin-dashboard__sidebar-actions-grid">
                <button
                  type="button"
                  className="admin-dashboard__sidebar-action admin-dashboard__sidebar-action--disabled"
                  onClick={() => setStatusMsg(t('adminDashboard.serverControlUnavailable'))}
                >
                  {status ? t('adminDashboard.stopServer') : t('adminDashboard.startServer')}
                </button>
                <button
                  type="button"
                  className="admin-dashboard__sidebar-action admin-dashboard__sidebar-action--disabled"
                  onClick={() => setStatusMsg(t('adminDashboard.serverControlUnavailable'))}
                >
                  {t('adminDashboard.restartServer')}
                </button>
                <button
                  type="button"
                  className="admin-dashboard__sidebar-action"
                  disabled={!capabilities.canKick || players.length === 0 || sidebarActionSending !== null}
                  onClick={() => { void kickAllPlayers(); }}
                >
                  {sidebarActionSending === 'kick-all' ? t('adminDashboard.loading') : t('adminDashboard.kickAllPlayers')}
                </button>
                <button
                  type="button"
                  className="admin-dashboard__sidebar-action"
                  disabled={!capabilities.canMessage || sidebarActionSending !== null}
                  onClick={() => { void sendAnnouncement(); }}
                >
                  {sidebarActionSending === 'announcement' ? t('adminDashboard.loading') : t('adminDashboard.sendAnnouncement')}
                </button>
                <button
                  type="button"
                  className="admin-dashboard__sidebar-action admin-dashboard__sidebar-action--secondary"
                  onClick={resetDashboardPreferences}
                >
                  {t('adminDashboard.resetView')}
                </button>
              </div>
              <div className="admin-dashboard__sidebar-action-hint">{t('adminDashboard.sidebarActionHint')}</div>
            </div>
          </aside>

          <main className="admin-dashboard__main">
            <div className="admin-dashboard__main-header">
              <div>
                <h2 className="admin-dashboard__main-title">{currentTabLabel}</h2>
                <p className="admin-dashboard__main-subtitle">{t('adminDashboard.subtitle')}</p>
              </div>
              <div className="admin-dashboard__main-meta">
                {lastUpdated && <span className="admin-dashboard__updated">{t('adminDashboard.updated')}: {lastUpdated}</span>}
              </div>
            </div>

            <div className="admin-dashboard__summary-grid">
              {summaryCards.map((card) => (
                <div key={card.label} className="admin-dashboard__summary-card">
                  <div className="admin-dashboard__summary-label">{card.label}</div>
                  <div className={`admin-dashboard__summary-value${card.accent ? ' admin-dashboard__summary-value--accent' : ''}`}>{card.value}</div>
                </div>
              ))}
            </div>

            {loading && <div className="admin-dashboard__loading">{t('adminDashboard.loading')}</div>}

            {!loading && (
              <>

            {activeTab === 'overview' && status && (
              <div className="admin-dashboard__panel" id="admin-panel-overview" role="tabpanel" aria-labelledby="admin-tab-overview">
                <div className="admin-dashboard__overview-info">
                  {[
                    { k: t('adminDashboard.serverName'), v: status.name || '-' },
                    { k: t('adminDashboard.port'), v: String(status.port) },
                    { k: t('adminDashboard.uptime'), v: formatAdminUptime(status.uptimeSec) },
                    { k: t('adminDashboard.online'), v: `${status.online} / ${status.maxPlayers}` },
                    { k: t('adminDashboard.user'), v: adminUser || '-' },
                    { k: t('adminDashboard.role'), v: t(`adminDashboard.role_${adminRole}`) },
                  ].map(({ k, v }) => (
                    <div key={k} className="admin-dashboard__info-row">
                      <span className="admin-dashboard__info-key">{k}</span>
                      <span className="admin-dashboard__info-val">{v}</span>
                    </div>
                  ))}
                </div>

                <div className="admin-dashboard__capabilities">
                  <h3 className="admin-dashboard__section-subtitle">{t('adminDashboard.permissionsTitle')}</h3>
                  <div className="admin-dashboard__capabilities-list">
                    {capabilityRows.map(({ key, label }) => {
                      const enabled = capabilities[key];
                      return (
                        <div key={key} className="admin-dashboard__capability-row">
                          <span className="admin-dashboard__capability-label">{label}</span>
                          <span className={`admin-dashboard__capability-state ${enabled ? 'is-enabled' : 'is-disabled'}`}>
                            {enabled ? t('adminDashboard.capabilityEnabled') : t('adminDashboard.capabilityDisabled')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'players' && (
              <div className="admin-dashboard__panel" id="admin-panel-players" data-testid="admin-panel-players" role="tabpanel" aria-labelledby="admin-tab-players">
                <div className="admin-dashboard__panel-toolbar">
                  <div className="admin-dashboard__panel-toolbar-left">
                    <span className="admin-dashboard__panel-toolbar-title">{t('adminDashboard.tabPlayers')}</span>
                    {filteredPlayers.length > 0 && <span className="admin-dashboard__panel-badge">{filteredPlayers.length}</span>}
                  </div>
                </div>
                <div className="admin-dashboard__search-row">
                  <input
                    className="admin-dashboard__search-input"
                    type="text"
                    placeholder={t('adminDashboard.searchPlaceholder')}
                    aria-label={t('adminDashboard.searchPlaceholder')}
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                  />
                  <input
                    className="admin-dashboard__search-input admin-dashboard__search-input--reason"
                    data-testid="admin-reason-input"
                    type="text"
                    placeholder={t('adminDashboard.reasonPlaceholder')}
                    aria-label={t('adminDashboard.reasonLabel')}
                    value={moderationReason}
                    onChange={(e) => setModerationReason(e.target.value)}
                  />
                  <label className="admin-dashboard__mute-duration">
                    <span>{t('adminDashboard.muteDuration')}</span>
                    <select
                      className="admin-dashboard__log-select"
                      data-testid="admin-mute-duration-select"
                      value={muteDurationMinutes}
                      onChange={(e) => setMuteDurationMinutes(Number(e.target.value))}
                      aria-label={t('adminDashboard.muteDuration')}
                    >
                      {[5, 10, 15, 30, 60, 180, 720].map((value) => (
                        <option key={value} value={value}>{value}m</option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-dashboard__mute-duration">
                    <span>{t('adminDashboard.banDuration')}</span>
                    <select
                      className="admin-dashboard__log-select"
                      data-testid="admin-ban-duration-select"
                      value={banDurationMinutes}
                      onChange={(e) => setBanDurationMinutes(Number(e.target.value))}
                      aria-label={t('adminDashboard.banDuration')}
                    >
                      <option value={0}>{t('adminDashboard.banPermanent')}</option>
                      {[60, 180, 720, 1440, 4320, 10080, 43200].map((value) => (
                        <option key={value} value={value}>{value >= 1440 ? `${value / 1440}d` : `${value}m`}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {filteredPlayers.length === 0 ? (
                  <p className="admin-dashboard__no-players">
                    {players.length === 0 ? t('adminDashboard.noPlayers') : t('adminDashboard.noMatch')}
                  </p>
                ) : (
                  <div className="admin-dashboard__table-wrapper" data-testid="admin-players-table">
                    <table className="admin-dashboard__table">
                      <caption className="admin-dashboard__sr-only">{t('adminDashboard.tabPlayers')}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{t('adminDashboard.userId')}</th>
                          <th scope="col">{t('adminDashboard.actorId')}</th>
                          <th scope="col">{t('adminDashboard.name')}</th>
                          <th scope="col">{t('adminDashboard.ip')}</th>
                          <th scope="col">{t('adminDashboard.pos')}</th>
                          <th scope="col">{t('adminDashboard.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPlayers.map((player) => {
                          const muteEntry = activeMuteByUserId.get(player.userId);
                          const remainingSec = muteEntry ? Math.max(0, Math.floor((muteEntry.expiresAt - nowTs) / 1000)) : 0;
                          const banEntry = activeBanByUserId.get(player.userId);
                          const banRemainingSec = banEntry && !banEntry.permanent && banEntry.expiresAt !== null
                            ? Math.max(0, Math.floor((banEntry.expiresAt - nowTs) / 1000))
                            : null;
                          return (
                          <tr key={player.userId} data-testid={`admin-player-row-${player.userId}`}>
                            <td>{player.userId}</td>
                            <td>{player.actorId || '-'}</td>
                            <td>
                              <span>{player.actorName || '-'}</span>
                              {muteEntry && (
                                <span className="admin-dashboard__muted-badge" data-testid={`admin-muted-badge-${player.userId}`} title={t('adminDashboard.muted')}>
                                  {t('adminDashboard.muted')}: {formatAdminUptime(remainingSec)}
                                </span>
                              )}
                              {banEntry && (
                                <span className="admin-dashboard__banned-badge" data-testid={`admin-banned-badge-${player.userId}`} title={t('adminDashboard.banned')}>
                                  {t('adminDashboard.banned')}{banRemainingSec !== null ? `: ${formatAdminUptime(banRemainingSec)}` : ''}
                                </span>
                              )}
                            </td>
                            <td>{player.ip}</td>
                            <td className="admin-dashboard__pos">{formatAdminPos(player.pos)}</td>
                            <td className="admin-dashboard__actions-cell">
                              <button
                                type="button"
                                className="admin-dashboard__kick-btn"
                                onClick={() => kickPlayer(player.userId)}
                                disabled={!capabilities.canKick}
                                title={!capabilities.canKick ? t('adminDashboard.noPermission') : undefined}
                              >
                                {t('adminDashboard.kick')}
                              </button>
                              <button
                                type="button"
                                className="admin-dashboard__ban-btn"
                                onClick={() => banPlayer(player.userId)}
                                disabled={!capabilities.canBan}
                                title={!capabilities.canBan ? t('adminDashboard.noPermission') : undefined}
                              >
                                {t('adminDashboard.ban')}
                              </button>
                              <button
                                type="button"
                                className="admin-dashboard__mute-btn"
                                data-testid={`admin-mute-btn-${player.userId}`}
                                onClick={() => mutePlayer(player.userId)}
                                disabled={!capabilities.canMute}
                                title={!capabilities.canMute ? t('adminDashboard.noPermission') : undefined}
                              >
                                {t('adminDashboard.mute')}
                              </button>
                                <button
                                  type="button"
                                  className="admin-dashboard__msg-btn"
                                  data-testid={`admin-msg-btn-${player.userId}`}
                                  onClick={() => {
                                    setSendMsgTargetId(player.userId);
                                    setSendMsgTargetName(player.actorName || String(player.userId));
                                    setSendMsgText('');
                                    setStatusMsg('');
                                  }}
                                  disabled={!capabilities.canMessage}
                                  title={!capabilities.canMessage ? t('adminDashboard.noPermission') : undefined}
                                >
                                  {t('adminDashboard.messageBtn')}
                                </button>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                )}

                {(capabilities.canBan || capabilities.canUnban) && (
                  <div className="admin-dashboard__bans-section">
                    <h3 className="admin-dashboard__section-subtitle">{t('adminDashboard.bannedUsers')}</h3>
                    {activeBannedUsers.length === 0 ? (
                      <p className="admin-dashboard__bans-empty">{t('adminDashboard.noBans')}</p>
                    ) : (
                      <div className="admin-dashboard__bans-list">
                        {activeBannedUsers.map((entry) => {
                          const remainingBanSec = entry.permanent ? null : Math.max(0, Math.floor(((entry.expiresAt ?? 0) - nowTs) / 1000));
                          return (
                          <div key={entry.userId} className="admin-dashboard__ban-row" data-testid={`admin-banned-row-${entry.userId}`}>
                            <span className="admin-dashboard__ban-user">
                              userId: {entry.userId}
                              {entry.permanent
                                ? ` • ${t('adminDashboard.banPermanent')}`
                                : remainingBanSec !== null ? ` • ${t('adminDashboard.banRemaining')}: ${formatAdminUptime(remainingBanSec)}` : ''}
                            </span>
                            <button
                              type="button"
                              className="admin-dashboard__unban-btn"
                              data-testid={`admin-unban-btn-${entry.userId}`}
                              onClick={() => unbanPlayer(entry.userId)}
                              disabled={!capabilities.canUnban}
                              title={!capabilities.canUnban ? t('adminDashboard.noPermission') : undefined}
                            >
                              {t('adminDashboard.unban')}
                            </button>
                          </div>
                        )})}
                      </div>
                    )}
                  </div>
                )}

                {(capabilities.canMute || capabilities.canUnmute) && (
                  <div className="admin-dashboard__bans-section" data-testid="admin-muted-users-section">
                    <h3 className="admin-dashboard__section-subtitle">{t('adminDashboard.mutedUsers')}</h3>
                    {activeMutedUsers.length === 0 ? (
                      <p className="admin-dashboard__bans-empty">{t('adminDashboard.noMutes')}</p>
                    ) : (
                      <div className="admin-dashboard__bans-list">
                        {activeMutedUsers.map((entry) => (
                          <div key={entry.userId} className="admin-dashboard__ban-row" data-testid={`admin-muted-row-${entry.userId}`}>
                            <span className="admin-dashboard__ban-user">
                              userId: {entry.userId} • {t('adminDashboard.muteRemaining')}: {formatAdminUptime(Math.max(0, Math.floor((entry.expiresAt - nowTs) / 1000)))}
                            </span>
                            <button
                              type="button"
                              className="admin-dashboard__unban-btn"
                              data-testid={`admin-unmute-btn-${entry.userId}`}
                              onClick={() => unmutePlayer(entry.userId)}
                              disabled={!capabilities.canUnmute}
                              title={!capabilities.canUnmute ? t('adminDashboard.noPermission') : undefined}
                            >
                              {t('adminDashboard.unmute')}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {statusMsg && <div className="admin-dashboard__status-msg" data-testid="admin-status-msg" role="status" aria-live="polite">{statusMsg}</div>}
              </div>
            )}

            {activeTab === 'players' && sendMsgTargetId !== null && (
              <div className="admin-dashboard__msg-form" data-testid="admin-message-form">
                <h3 className="admin-dashboard__section-subtitle">
                  {t('adminDashboard.sendMessageTitle')}: {sendMsgTargetName}
                </h3>
                <div className="admin-dashboard__msg-row">
                  <input
                    className="admin-dashboard__msg-input"
                    data-testid="admin-message-input"
                    type="text"
                    placeholder={t('adminDashboard.messagePlaceholder')}
                    aria-label={t('adminDashboard.messagePlaceholder')}
                    value={sendMsgText}
                    onChange={(e) => setSendMsgText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void sendMessageToPlayer();
                      if (e.key === 'Escape') { setSendMsgTargetId(null); setSendMsgText(''); }
                    }}
                    disabled={sendMsgSending}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="admin-dashboard__msg-send-btn"
                    data-testid="admin-message-send-btn"
                    onClick={() => void sendMessageToPlayer()}
                    disabled={sendMsgSending || !sendMsgText.trim()}
                  >
                    {t('adminDashboard.messageSend')}
                  </button>
                  <button
                    type="button"
                    className="admin-dashboard__msg-cancel-btn"
                    data-testid="admin-message-cancel-btn"
                    onClick={() => { setSendMsgTargetId(null); setSendMsgText(''); }}
                  >
                    {t('adminDashboard.messageCancel')}
                  </button>
                </div>
              </div>
            )}
            {activeTab === 'console' && (
              <div className="admin-dashboard__panel" id="admin-panel-console" role="tabpanel" aria-labelledby="admin-tab-console">
                <div className="admin-dashboard__console-out" role="log" aria-live="polite" aria-relevant="additions text">
                  {serverConsoleEntries.length === 0 && consoleLines.length === 0 && (
                    <div className="admin-dashboard__console-line admin-dashboard__console-line--input">
                      {t('adminDashboard.noLogs')}
                    </div>
                  )}
                  {serverConsoleEntries.map((entry, i) => (
                    <div key={`server-${entry.ts}-${i}`} className={`admin-dashboard__console-line admin-dashboard__console-line--${entry.level === 'error' ? 'err' : 'ok'}`}>
                      [{formatAdminTime(entry.ts)}] {entry.level ?? 'info'}: {entry.message}
                    </div>
                  ))}
                  {consoleLines.length > 0 && (
                    <div className="admin-dashboard__console-line admin-dashboard__console-line--input">
                      {t('adminDashboard.consoleCommandOutput')}
                    </div>
                  )}
                  {consoleLines.map((line, i) => (
                    <div key={i} className={`admin-dashboard__console-line admin-dashboard__console-line--${line.kind}`}>
                      {line.text}
                    </div>
                  ))}
                  <div ref={consoleEndRef} />
                </div>

                <div className="admin-dashboard__console-row">
                  <input
                    className="admin-dashboard__console-input"
                    type="text"
                    placeholder={t('adminDashboard.consoleHint')}
                    aria-label={t('adminDashboard.consoleHint')}
                    value={consoleInput}
                    onChange={(e) => setConsoleInput(e.target.value)}
                    onKeyDown={handleConsoleKeyDown}
                    disabled={consoleSending || !capabilities.canConsole}
                  />
                  <button
                    type="button"
                    className="admin-dashboard__console-send-btn"
                    onClick={() => void sendConsoleCommand()}
                    disabled={consoleSending || !capabilities.canConsole}
                  >
                    {t('adminDashboard.consoleSend')}
                  </button>
                </div>

                <div className="admin-dashboard__console-history">
                  <span className="admin-dashboard__console-history-label">{t('adminDashboard.consoleHistory')}</span>
                  <button
                    type="button"
                    className="admin-dashboard__console-clear-btn"
                    onClick={() => setConsoleLines([])}
                    disabled={consoleLines.length === 0}
                  >
                    {t('adminDashboard.consoleClearOutput')}
                  </button>
                  <div className="admin-dashboard__console-history-list">
                    {consoleHistory.length === 0 ? (
                      <span className="admin-dashboard__console-history-empty">{t('adminDashboard.consoleHistoryEmpty')}</span>
                    ) : (
                      consoleHistory.slice(0, 8).map((item) => (
                        <button
                          key={item}
                          type="button"
                          className="admin-dashboard__console-history-item"
                          onClick={() => setConsoleInput(item)}
                          disabled={!capabilities.canConsole}
                        >
                          {item}
                        </button>
                      ))
                    )}
                  </div>
                  <button
                    type="button"
                    className="admin-dashboard__console-clear-btn"
                    onClick={() => {
                      setConsoleHistory([]);
                      setConsoleHistoryIndex(null);
                    }}
                    disabled={consoleHistory.length === 0}
                  >
                    {t('adminDashboard.consoleClearHistory')}
                  </button>
                </div>

                {!capabilities.canConsole && (
                  <p className="admin-dashboard__console-note admin-dashboard__console-note--warn">
                    {t('adminDashboard.consoleDisabled')}
                  </p>
                )}
                <p className="admin-dashboard__console-note">{t('adminDashboard.consoleNote')}</p>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="admin-dashboard__panel" id="admin-panel-logs" role="tabpanel" aria-labelledby="admin-tab-logs">
                {!capabilities.canViewLogs && (
                  <p className="admin-dashboard__no-players">{t('adminDashboard.logsDisabled')}</p>
                )}

                {capabilities.canViewLogs && (
                  <>
                    <div className="admin-dashboard__panel-toolbar">
                      <div className="admin-dashboard__panel-toolbar-left">
                        <span className="admin-dashboard__panel-toolbar-title">{t('adminDashboard.tabLogs')}</span>
                        {logEntries.length > 0 && <span className="admin-dashboard__panel-badge">{logEntries.length}</span>}
                      </div>
                      <div className="admin-dashboard__panel-toolbar-right">
                        <button type="button" className="admin-dashboard__log-page-btn" onClick={openRecentLogs} disabled={logBeforeTs === null}>
                          {t('adminDashboard.logRecent')}
                        </button>
                        <button type="button" className="admin-dashboard__log-page-btn" onClick={openOlderLogs} disabled={!logHasMore || oldestLogTs === null}>
                          {t('adminDashboard.logOlder')}
                        </button>
                      </div>
                    </div>
                    <div className="admin-dashboard__log-tools">
                      <label className="admin-dashboard__log-tool">
                        <span>{t('adminDashboard.logLimit')}</span>
                        <select
                          className="admin-dashboard__log-select"
                          value={logLimit}
                          aria-label={t('adminDashboard.logLimit')}
                          onChange={(e) => setLogLimit(Number(e.target.value))}
                        >
                          {[25, 50, 100, 200].map((value) => (
                            <option key={value} value={value}>{value}</option>
                          ))}
                        </select>
                      </label>

                      <label className="admin-dashboard__log-tool">
                        <span>{t('adminDashboard.logWindow')}</span>
                        <select
                          className="admin-dashboard__log-select"
                          value={logSinceMinutes}
                          aria-label={t('adminDashboard.logWindow')}
                          onChange={(e) => setLogSinceMinutes(e.target.value as '' | '15' | '60' | '1440')}
                        >
                          <option value="">{t('adminDashboard.logWindowAll')}</option>
                          <option value="15">{t('adminDashboard.logWindow15m')}</option>
                          <option value="60">{t('adminDashboard.logWindow1h')}</option>
                          <option value="1440">{t('adminDashboard.logWindow24h')}</option>
                        </select>
                      </label>

                      <label className="admin-dashboard__log-tool">
                        <span>{t('adminDashboard.logLevel')}</span>
                        <select
                          className="admin-dashboard__log-select"
                          value={logLevelFilter}
                          aria-label={t('adminDashboard.logLevel')}
                          onChange={(e) => setLogLevelFilter(e.target.value as '' | ServerLogLevel)}
                        >
                          <option value="">{t('adminDashboard.logLevelAll')}</option>
                          <option value="info">{t('adminDashboard.logLevel_info')}</option>
                          <option value="error">{t('adminDashboard.logLevel_error')}</option>
                        </select>
                      </label>
                    </div>

                    <div className="admin-dashboard__log-filters">
                      {(['', 'server', 'kick', 'ban', 'mute', 'console'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          className={`admin-dashboard__log-filter${logTypeFilter === type ? ' admin-dashboard__log-filter--active' : ''}`}
                          onClick={() => setLogTypeFilter(type)}
                          aria-pressed={logTypeFilter === type}
                        >
                          {type === '' ? t('adminDashboard.logAll') : t(`adminDashboard.logType_${type}`)}
                        </button>
                      ))}
                    </div>

                    {logEntries.length === 0 ? (
                      <p className="admin-dashboard__no-players">{t('adminDashboard.noLogs')}</p>
                    ) : (
                      <div className="admin-dashboard__log-list">
                        {logEntries.map((entry, i) => (
                          <div key={i} className="admin-dashboard__log-entry">
                            <span className="admin-dashboard__log-ts">{formatAdminTime(entry.ts)}</span>
                            <span className={`admin-dashboard__log-type admin-dashboard__log-type--${entry.type}`}>
                              {entry.type}
                            </span>
                            {entry.level && (
                              <span className={`admin-dashboard__log-type admin-dashboard__log-type--${entry.level === 'error' ? 'ban' : 'console'}`}>
                                {entry.level}
                              </span>
                            )}
                            <span className="admin-dashboard__log-msg">{entry.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'metrics' && (
              <div className="admin-dashboard__panel" id="admin-panel-metrics" role="tabpanel" aria-labelledby="admin-tab-metrics">
                {!capabilities.canViewLogs && (
                  <p className="admin-dashboard__no-players">{t('adminDashboard.metricsDisabled')}</p>
                )}

                {capabilities.canViewLogs && (
                  <>
                    <div className="admin-dashboard__metrics-toolbar">
                      <input
                        className="admin-dashboard__metrics-input"
                        type="text"
                        placeholder={t('adminDashboard.metricsSearchPlaceholder')}
                        aria-label={t('adminDashboard.metricsSearchPlaceholder')}
                        value={metricNameFilter}
                        onChange={(e) => setMetricNameFilter(e.target.value)}
                      />

                      <select
                        className="admin-dashboard__log-select"
                        value={metricSourceFilter}
                        aria-label={t('adminDashboard.metricsAllSources')}
                        onChange={(e) => setMetricSourceFilter(e.target.value)}
                      >
                        <option value="">{t('adminDashboard.metricsAllSources')}</option>
                        {metricSourceOptions.map((source) => (
                          <option key={source} value={source}>{source}</option>
                        ))}
                      </select>

                      <select
                        className="admin-dashboard__log-select"
                        value={metricLimit}
                        aria-label={t('adminDashboard.logLimit')}
                        onChange={(e) => setMetricLimit(Number(e.target.value))}
                      >
                        {[25, 50, 100, 200].map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>

                      <button type="button" className="admin-dashboard__log-page-btn" onClick={() => void fetchFrontendMetrics()}>
                        {t('adminDashboard.metricsRefresh')}
                      </button>
                    </div>

                    <div className="admin-dashboard__metrics-grid">
                      <div className="admin-dashboard__metric-card">
                        <span className="admin-dashboard__metric-label">{t('adminDashboard.metricsTotal')}</span>
                        <span className="admin-dashboard__metric-value">{metricSummary.totalCount}</span>
                      </div>
                      <div className="admin-dashboard__metric-card">
                        <span className="admin-dashboard__metric-label">{t('adminDashboard.metricsErrors')}</span>
                        <span className="admin-dashboard__metric-value admin-dashboard__metric-value--warn">{metricSummary.errorCount}</span>
                      </div>
                      <div className="admin-dashboard__metric-card">
                        <span className="admin-dashboard__metric-label">{t('adminDashboard.metricsAverage')}</span>
                        <span className="admin-dashboard__metric-value">{metricSummary.averageValue}</span>
                      </div>
                      <div className="admin-dashboard__metric-card">
                        <span className="admin-dashboard__metric-label">{t('adminDashboard.metricsLastReceived')}</span>
                        <span className="admin-dashboard__metric-value admin-dashboard__metric-value--small">
                          {metricSummary.lastReceivedAt ? formatAdminTime(metricSummary.lastReceivedAt) : '-'}
                        </span>
                      </div>
                    </div>

                    <div className="admin-dashboard__metrics-groups">
                      <div className="admin-dashboard__bans-section">
                        <h3 className="admin-dashboard__section-subtitle">{t('adminDashboard.metricsTopSources')}</h3>
                        <div className="admin-dashboard__metric-chips">
                          {metricSummary.sources.length === 0 && <span className="admin-dashboard__console-history-empty">-</span>}
                          {metricSummary.sources.map((item) => (
                            <span key={item.name} className="admin-dashboard__metric-chip">{item.name} ({item.count})</span>
                          ))}
                        </div>
                      </div>

                      <div className="admin-dashboard__bans-section">
                        <h3 className="admin-dashboard__section-subtitle">{t('adminDashboard.metricsTopNames')}</h3>
                        <div className="admin-dashboard__metric-chips">
                          {metricSummary.names.length === 0 && <span className="admin-dashboard__console-history-empty">-</span>}
                          {metricSummary.names.map((item) => (
                            <span key={item.name} className="admin-dashboard__metric-chip">{item.name} ({item.count})</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {metricEntries.length === 0 ? (
                      <p className="admin-dashboard__no-players">{t('adminDashboard.metricsEmpty')}</p>
                    ) : (
                      <div className="admin-dashboard__metrics-list">
                        {metricEntries.map((entry, index) => (
                          <div key={`${entry.name}-${entry.receivedAt}-${index}`} className="admin-dashboard__metrics-entry">
                            <div className="admin-dashboard__metrics-main">
                              <span className="admin-dashboard__metrics-name">{entry.name}</span>
                              <span className="admin-dashboard__metrics-source">{entry.source}</span>
                              <span className="admin-dashboard__metrics-value">{entry.value}</span>
                            </div>
                            <div className="admin-dashboard__metrics-meta">
                              <span>{t('adminDashboard.metricsEventTs')}: {formatAdminTime(entry.ts)}</span>
                              <span>{t('adminDashboard.metricsReceivedTs')}: {formatAdminTime(entry.receivedAt)}</span>
                              {entry.clientSource && <span>Client: {entry.clientSource}</span>}
                              {entry.sessionId && <span>Session: {entry.sessionId}</span>}
                              {entry.path && <span>Path: {entry.path}</span>}
                              {entry.visibilityState && <span>Visibility: {entry.visibilityState}</span>}
                              {entry.language && <span>Lang: {entry.language}</span>}
                              {entry.platform && <span>Platform: {entry.platform}</span>}
                              {entry.userAgent && <span>UA: {entry.userAgent}</span>}
                              {entry.url && <span>{entry.url}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="admin-dashboard__metrics-groups" style={{ marginTop: 16 }}>
                      <div className="admin-dashboard__bans-section">
                        <h3 className="admin-dashboard__section-subtitle">Client Runtime Events (skymp5-client)</h3>
                        <div className="admin-dashboard__metric-chips">
                          <span className="admin-dashboard__metric-chip">Total {clientRuntimeSummary.totalCount}</span>
                          <span className="admin-dashboard__metric-chip">Errors {clientRuntimeSummary.errorCount}</span>
                          <span className="admin-dashboard__metric-chip">Warnings {clientRuntimeSummary.warnCount}</span>
                          <span className="admin-dashboard__metric-chip">
                            Last {clientRuntimeSummary.lastReceivedAt ? formatAdminTime(clientRuntimeSummary.lastReceivedAt) : '-'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {clientRuntimeEntries.length === 0 ? (
                      <p className="admin-dashboard__no-players">No client runtime events yet.</p>
                    ) : (
                      <div className="admin-dashboard__log-list" style={{ marginTop: 10 }}>
                        {clientRuntimeEntries.map((entry, index) => (
                          <div key={`${entry.userId}-${entry.receivedAt}-${index}`} className="admin-dashboard__log-entry">
                            <span className="admin-dashboard__log-ts">{formatAdminTime(entry.receivedAt)}</span>
                            <span className={`admin-dashboard__log-type admin-dashboard__log-type--${entry.level === 'error' ? 'ban' : entry.level === 'warn' ? 'kick' : 'console'}`}>
                              {entry.level}
                            </span>
                            <span className="admin-dashboard__log-msg">
                              [{entry.event}] userId={entry.userId} {entry.ip ? `ip=${entry.ip}` : ''} {entry.details || ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'cfg' && (
              <div className="admin-dashboard__panel" id="admin-panel-cfg" role="tabpanel" aria-labelledby="admin-tab-cfg">
                <div className="admin-dashboard__panel-toolbar">
                  <div className="admin-dashboard__panel-toolbar-left">
                    <span className="admin-dashboard__panel-toolbar-title">{t('adminDashboard.cfgEditorTitle')}</span>
                  </div>
                  <div className="admin-dashboard__panel-toolbar-right">
                    <button type="button" className="admin-dashboard__log-btn" onClick={() => void loadCfgEditor()} disabled={cfgEditorLoading || cfgEditorSaving}>
                      {t('adminDashboard.cfgLoad')}
                    </button>
                    <button
                      type="button"
                      className="admin-dashboard__log-btn"
                      onClick={() => {
                        try {
                          const normalized = mergeCfgFormIntoJson(cfgEditorText || '{}', cfgForm);
                          setCfgEditorText(normalized);
                          setCfgEditorStatus(t('adminDashboard.cfgFormApplied'));
                        } catch {
                          setCfgEditorStatus(t('adminDashboard.cfgInvalidJson'));
                        }
                      }}
                      disabled={cfgEditorLoading || cfgEditorSaving}
                    >
                      {t('adminDashboard.cfgApplyForm')}
                    </button>
                    <button type="button" className="admin-dashboard__log-btn" onClick={formatCfgEditor} disabled={cfgEditorLoading || cfgEditorSaving}>
                      {t('adminDashboard.cfgFormat')}
                    </button>
                    <button type="button" className="admin-dashboard__log-btn" onClick={applyAccessDiscordToCfgEditor} disabled={cfgEditorLoading || cfgEditorSaving}>
                      {t('adminDashboard.cfgApplyAccess')}
                    </button>
                    <button
                      type="button"
                      className="admin-dashboard__log-btn admin-dashboard__log-btn--primary"
                      onClick={async () => {
                        const normalized = applyAccessDiscordToCfgEditor();
                        if (!normalized) return;
                        await saveCfgEditor(normalized);
                      }}
                      disabled={cfgEditorLoading || cfgEditorSaving}
                    >
                      {t('adminDashboard.cfgSaveAccess')}
                    </button>
                    <button type="button" className="admin-dashboard__log-btn admin-dashboard__log-btn--primary" onClick={() => void saveCfgEditor()} disabled={cfgEditorLoading || cfgEditorSaving}>
                      {cfgEditorSaving ? t('adminDashboard.loading') : t('adminDashboard.cfgSave')}
                    </button>
                  </div>
                </div>

                <div className="admin-dashboard__cfg-tabs" role="tablist" aria-label={t('adminDashboard.cfgEditorTitle')}>
                  {(['general', 'access', 'inventory', 'json'] as CfgEditorTab[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={cfgEditorTab === tab}
                      className={`admin-dashboard__cfg-tab${cfgEditorTab === tab ? ' admin-dashboard__cfg-tab--active' : ''}`}
                      onClick={() => setCfgEditorTab(tab)}
                    >
                      {t(`adminDashboard.cfgTab_${tab}`)}
                    </button>
                  ))}
                </div>

                {cfgEditorTab === 'general' && (
                  <div className="admin-dashboard__cfg-form-grid">
                    <label className="admin-dashboard__cfg-field">
                      <span>{t('adminDashboard.cfgServerName')}</span>
                      <input
                        className="admin-dashboard__search-input"
                        type="text"
                        value={cfgForm.serverName}
                        onChange={(e) => setCfgForm((prev) => ({ ...prev, serverName: e.target.value }))}
                      />
                    </label>

                    <label className="admin-dashboard__cfg-field">
                      <span>{t('adminDashboard.cfgPort')}</span>
                      <input
                        className="admin-dashboard__search-input"
                        type="number"
                        min={1}
                        value={cfgForm.port}
                        onChange={(e) => setCfgForm((prev) => ({ ...prev, port: Number(e.target.value) || 1 }))}
                      />
                    </label>

                    <label className="admin-dashboard__cfg-field">
                      <span>{t('adminDashboard.cfgMaxPlayers')}</span>
                      <input
                        className="admin-dashboard__search-input"
                        type="number"
                        min={1}
                        value={cfgForm.maxPlayers}
                        onChange={(e) => setCfgForm((prev) => ({ ...prev, maxPlayers: Number(e.target.value) || 1 }))}
                      />
                    </label>

                    <label className="admin-dashboard__cfg-field">
                      <span>{t('adminDashboard.cfgLanguage')}</span>
                      <select
                        className="admin-dashboard__log-select"
                        value={cfgForm.defaultLanguage}
                        onChange={(e) => setCfgForm((prev) => ({ ...prev, defaultLanguage: e.target.value }))}
                      >
                        <option value="en">en</option>
                        <option value="de">de</option>
                        <option value="es">es</option>
                        <option value="ru">ru</option>
                      </select>
                    </label>

                    <label className="admin-dashboard__cfg-check">
                      <input
                        type="checkbox"
                        checked={cfgForm.offlineMode}
                        onChange={(e) => setCfgForm((prev) => ({ ...prev, offlineMode: e.target.checked }))}
                      />
                      <span>{t('adminDashboard.cfgOfflineMode')}</span>
                    </label>
                  </div>
                )}

                {cfgEditorTab === 'access' && (
                  <div className="admin-dashboard__cfg-form-grid">
                    <label className="admin-dashboard__cfg-check">
                      <input
                        type="checkbox"
                        checked={cfgForm.discordBot.enabled}
                        onChange={(e) => setCfgForm((prev) => ({ ...prev, discordBot: { ...prev.discordBot, enabled: e.target.checked } }))}
                      />
                      <span>{t('adminDashboard.cfgDiscordEnabled')}</span>
                    </label>

                    <label className="admin-dashboard__cfg-field admin-dashboard__cfg-field--full">
                      <span>{t('adminDashboard.cfgJoinMode')}</span>
                      <select
                        className="admin-dashboard__log-select"
                        value={cfgForm.joinAccess.mode}
                        onChange={(e) => setCfgForm((prev) => ({ ...prev, joinAccess: { ...prev.joinAccess, mode: e.target.value as JoinAccessForm['mode'] } }))}
                      >
                        <option value="none">{t('adminDashboard.cfgJoinMode_none')}</option>
                        <option value="approvedLicense">{t('adminDashboard.cfgJoinMode_approvedLicense')}</option>
                        <option value="discordMember">{t('adminDashboard.cfgJoinMode_discordMember')}</option>
                        <option value="discordRoles">{t('adminDashboard.cfgJoinMode_discordRoles')}</option>
                      </select>
                    </label>

                    <label className="admin-dashboard__cfg-field admin-dashboard__cfg-field--full">
                      <span>{t('adminDashboard.cfgRejectMessage')}</span>
                      <input
                        className="admin-dashboard__search-input"
                        type="text"
                        value={cfgForm.joinAccess.rejectionMessage}
                        onChange={(e) => setCfgForm((prev) => ({ ...prev, joinAccess: { ...prev.joinAccess, rejectionMessage: e.target.value } }))}
                      />
                    </label>

                    <label className="admin-dashboard__cfg-field">
                      <span>{t('adminDashboard.cfgApprovedLicenses')}</span>
                      <input
                        className="admin-dashboard__search-input"
                        type="text"
                        value={cfgForm.joinAccess.approvedLicenses}
                        onChange={(e) => setCfgForm((prev) => ({ ...prev, joinAccess: { ...prev.joinAccess, approvedLicenses: e.target.value } }))}
                      />
                    </label>

                    <label className="admin-dashboard__cfg-field">
                      <span>{t('adminDashboard.cfgApprovedDiscordIds')}</span>
                      <input
                        className="admin-dashboard__search-input"
                        type="text"
                        value={cfgForm.joinAccess.approvedDiscordIds}
                        onChange={(e) => setCfgForm((prev) => ({ ...prev, joinAccess: { ...prev.joinAccess, approvedDiscordIds: e.target.value } }))}
                      />
                    </label>

                    <label className="admin-dashboard__cfg-field">
                      <span>{t('adminDashboard.cfgDiscordRoles')}</span>
                      <input
                        className="admin-dashboard__search-input"
                        type="text"
                        value={cfgForm.joinAccess.discordRoleIds}
                        onChange={(e) => setCfgForm((prev) => ({ ...prev, joinAccess: { ...prev.joinAccess, discordRoleIds: e.target.value } }))}
                      />
                    </label>

                    <label className="admin-dashboard__cfg-field">
                      <span>{t('adminDashboard.cfgDiscordToken')}</span>
                      <input
                        className="admin-dashboard__search-input"
                        type="password"
                        value={cfgForm.discordBot.token}
                        onChange={(e) => setCfgForm((prev) => ({ ...prev, discordBot: { ...prev.discordBot, token: e.target.value } }))}
                      />
                    </label>

                    <label className="admin-dashboard__cfg-field">
                      <span>{t('adminDashboard.cfgDiscordGuildId')}</span>
                      <input
                        className="admin-dashboard__search-input"
                        type="text"
                        value={cfgForm.discordBot.guildId}
                        onChange={(e) => setCfgForm((prev) => ({ ...prev, discordBot: { ...prev.discordBot, guildId: e.target.value } }))}
                      />
                    </label>

                    <label className="admin-dashboard__cfg-field">
                      <span>{t('adminDashboard.cfgDiscordWarningsChannel')}</span>
                      <input
                        className="admin-dashboard__search-input"
                        type="text"
                        value={cfgForm.discordBot.warningsChannelId}
                        onChange={(e) => setCfgForm((prev) => ({ ...prev, discordBot: { ...prev.discordBot, warningsChannelId: e.target.value } }))}
                      />
                    </label>
                  </div>
                )}

                {cfgEditorTab === 'inventory' && (
                  <>
                    <div className="admin-dashboard__cfg-inventory">
                      <h4 className="admin-dashboard__section-subtitle">{t('adminDashboard.cfgStartSetup')}</h4>
                      <div className="admin-dashboard__cfg-form-grid">
                        <label className="admin-dashboard__cfg-field">
                          <span>{t('adminDashboard.cfgSpawnPreset')}</span>
                          <select
                            className="admin-dashboard__log-select"
                            value={selectedSpawnPresetKey}
                            onChange={(e) => {
                              const preset = SPAWN_PRESETS.find((entry) => entry.key === e.target.value);
                              if (!preset) {
                                return;
                              }
                              setCfgForm((prev) => ({
                                ...prev,
                                startSpawn: {
                                  x: preset.x,
                                  y: preset.y,
                                  z: preset.z,
                                  worldOrCell: preset.worldOrCell,
                                  angleZ: preset.angleZ,
                                },
                              }));
                            }}
                          >
                            <option value="">{t('adminDashboard.cfgSpawnPreset_custom')}</option>
                            {SPAWN_PRESETS.map((preset) => (
                              <option key={preset.key} value={preset.key}>{t(`adminDashboard.${preset.labelKey}`)}</option>
                            ))}
                          </select>
                        </label>

                        <label className="admin-dashboard__cfg-field">
                          <span>{t('adminDashboard.cfgSpawnX')}</span>
                          <input
                            className="admin-dashboard__search-input"
                            type="number"
                            value={cfgForm.startSpawn.x}
                            onChange={(e) => setCfgForm((prev) => ({ ...prev, startSpawn: { ...prev.startSpawn, x: Number(e.target.value) || 0 } }))}
                          />
                        </label>

                        <label className="admin-dashboard__cfg-field">
                          <span>{t('adminDashboard.cfgSpawnY')}</span>
                          <input
                            className="admin-dashboard__search-input"
                            type="number"
                            value={cfgForm.startSpawn.y}
                            onChange={(e) => setCfgForm((prev) => ({ ...prev, startSpawn: { ...prev.startSpawn, y: Number(e.target.value) || 0 } }))}
                          />
                        </label>

                        <label className="admin-dashboard__cfg-field">
                          <span>{t('adminDashboard.cfgSpawnZ')}</span>
                          <input
                            className="admin-dashboard__search-input"
                            type="number"
                            value={cfgForm.startSpawn.z}
                            onChange={(e) => setCfgForm((prev) => ({ ...prev, startSpawn: { ...prev.startSpawn, z: Number(e.target.value) || 0 } }))}
                          />
                        </label>

                        <label className="admin-dashboard__cfg-field">
                          <span>{t('adminDashboard.cfgSpawnWorldOrCell')}</span>
                          <select
                            className="admin-dashboard__log-select"
                            value={selectedWorldOrCellValue}
                            onChange={(e) => {
                              const nextValue = e.target.value;
                              if (nextValue === '__custom__') {
                                return;
                              }
                              setCfgForm((prev) => ({
                                ...prev,
                                startSpawn: {
                                  ...prev.startSpawn,
                                  worldOrCell: nextValue,
                                },
                              }));
                            }}
                          >
                            {selectedWorldOrCellValue === '__custom__' && (
                              <option value="__custom__">{t('adminDashboard.cfgWorldOrCellOption_custom')}</option>
                            )}
                            {WORLD_OR_CELL_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{t(`adminDashboard.${option.labelKey}`)}</option>
                            ))}
                          </select>
                          <span className="admin-dashboard__cfg-hint">{t(`adminDashboard.${worldOrCellHintKey}`)}</span>
                        </label>

                        <label className="admin-dashboard__cfg-field">
                          <span>{t('adminDashboard.cfgSpawnAngleZ')}</span>
                          <input
                            className="admin-dashboard__search-input"
                            type="number"
                            value={cfgForm.startSpawn.angleZ}
                            onChange={(e) => setCfgForm((prev) => ({ ...prev, startSpawn: { ...prev.startSpawn, angleZ: Number(e.target.value) || 0 } }))}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="admin-dashboard__cfg-inventory">
                      <h4 className="admin-dashboard__section-subtitle">{t('adminDashboard.cfgNpcSettings')}</h4>
                      <div className="admin-dashboard__cfg-form-grid">
                        <label className="admin-dashboard__cfg-check">
                          <input
                            type="checkbox"
                            checked={cfgForm.npcEnabled}
                            onChange={(e) => setCfgForm((prev) => ({ ...prev, npcEnabled: e.target.checked }))}
                          />
                          <span>{t('adminDashboard.cfgNpcEnabled')}</span>
                        </label>

                        <label className="admin-dashboard__cfg-check">
                          <input
                            type="checkbox"
                            checked={cfgForm.npcDefaultSettings.spawnInInterior}
                            onChange={(e) => setCfgForm((prev) => ({
                              ...prev,
                              npcDefaultSettings: {
                                ...prev.npcDefaultSettings,
                                spawnInInterior: e.target.checked,
                              },
                            }))}
                          />
                          <span>{t('adminDashboard.cfgNpcSpawnInInterior')}</span>
                        </label>

                        <label className="admin-dashboard__cfg-check">
                          <input
                            type="checkbox"
                            checked={cfgForm.npcDefaultSettings.spawnInExterior}
                            onChange={(e) => setCfgForm((prev) => ({
                              ...prev,
                              npcDefaultSettings: {
                                ...prev.npcDefaultSettings,
                                spawnInExterior: e.target.checked,
                              },
                            }))}
                          />
                          <span>{t('adminDashboard.cfgNpcSpawnInExterior')}</span>
                        </label>

                        <label className="admin-dashboard__cfg-check">
                          <input
                            type="checkbox"
                            checked={cfgForm.npcDefaultSettings.allowHumanoid}
                            onChange={(e) => setCfgForm((prev) => ({
                              ...prev,
                              npcDefaultSettings: {
                                ...prev.npcDefaultSettings,
                                allowHumanoid: e.target.checked,
                              },
                            }))}
                          />
                          <span>{t('adminDashboard.cfgNpcAllowHumanoid')}</span>
                        </label>

                        <label className="admin-dashboard__cfg-check">
                          <input
                            type="checkbox"
                            checked={cfgForm.npcDefaultSettings.allowCreature}
                            onChange={(e) => setCfgForm((prev) => ({
                              ...prev,
                              npcDefaultSettings: {
                                ...prev.npcDefaultSettings,
                                allowCreature: e.target.checked,
                              },
                            }))}
                          />
                          <span>{t('adminDashboard.cfgNpcAllowCreature')}</span>
                        </label>

                        <div className="admin-dashboard__cfg-field admin-dashboard__cfg-field--full">
                          <span className="admin-dashboard__cfg-hint">{t('adminDashboard.cfgNpcHint')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="admin-dashboard__cfg-inventory">
                      <h4 className="admin-dashboard__section-subtitle">{t('adminDashboard.cfgStarterInventory')}</h4>
                      <div className="admin-dashboard__cfg-inventory-controls">
                    <select className="admin-dashboard__log-select" value={inventoryCategory} onChange={(e) => setInventoryCategory(e.target.value as ItemCategory)}>
                      {ITEM_CATEGORIES.map((category) => (
                        <option key={category} value={category}>{t(`adminDashboard.itemCategory_${category}`)}</option>
                      ))}
                    </select>

                    <select className="admin-dashboard__log-select" value={inventoryItemCode} onChange={(e) => setInventoryItemCode(e.target.value)}>
                      {filteredCatalogItems.map((item) => (
                        <option key={item.codeHex} value={item.codeHex}>{`${t(`items.${item.codeHex}`, { defaultValue: item.name })} (${item.codeHex})`}</option>
                      ))}
                    </select>

                    <input
                      className="admin-dashboard__search-input"
                      type="text"
                      value={inventoryCustomCode}
                      placeholder={t('adminDashboard.cfgItemCodePlaceholder')}
                      onChange={(e) => setInventoryCustomCode(e.target.value)}
                    />

                    <input
                      className="admin-dashboard__search-input"
                      type="number"
                      min={1}
                      value={inventoryCount}
                      onChange={(e) => setInventoryCount(Number(e.target.value) || 1)}
                    />

                    <label className="admin-dashboard__cfg-check">
                      <input type="checkbox" checked={inventoryWorn} onChange={(e) => setInventoryWorn(e.target.checked)} />
                      <span>{t('adminDashboard.cfgWorn')}</span>
                    </label>
                    <label className="admin-dashboard__cfg-check">
                      <input type="checkbox" checked={inventoryWornLeft} onChange={(e) => setInventoryWornLeft(e.target.checked)} />
                      <span>{t('adminDashboard.cfgWornLeft')}</span>
                    </label>

                    <button type="button" className="admin-dashboard__log-btn admin-dashboard__log-btn--primary admin-dashboard__log-btn--icon" onClick={addStarterInventoryEntry} aria-label={t('adminDashboard.add')} title={t('adminDashboard.add')}>+</button>
                      </div>

                      <div className="admin-dashboard__table-wrapper">
                        <table className="admin-dashboard__table">
                          <thead>
                            <tr>
                              <th>{t('adminDashboard.cfgItem')}</th>
                              <th>{t('adminDashboard.cfgCode')}</th>
                              <th>{t('adminDashboard.cfgCount')}</th>
                              <th>{t('adminDashboard.cfgFlags')}</th>
                              <th>{t('adminDashboard.actions')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cfgForm.starterInventory.map((entry, index) => (
                              <tr key={`${entry.baseId}-${index}`}>
                                <td>{t(`items.${toCodeHex(entry.baseId)}`, { defaultValue: catalogNameByBaseId.get(entry.baseId) || t('adminDashboard.cfgCustomItem') })}</td>
                                <td>{toCodeHex(entry.baseId)}</td>
                                <td>{entry.count}</td>
                                <td>{[entry.worn ? 'worn' : null, entry.wornLeft ? 'wornLeft' : null].filter(Boolean).join(', ') || '-'}</td>
                                <td>
                                  <button type="button" className="admin-dashboard__kick-btn" onClick={() => removeStarterInventoryEntry(index)}>
                                    {t('adminDashboard.remove')}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}

                {cfgEditorTab === 'json' && (
                <textarea
                  className="admin-dashboard__cfg-editor"
                  value={cfgEditorText}
                  onChange={(e) => setCfgEditorText(e.target.value)}
                  spellCheck={false}
                  aria-label={t('adminDashboard.cfgEditorTitle')}
                />
                )}
                <div className="admin-dashboard__cfg-status">{cfgEditorStatus}</div>
              </div>
            )}

            {activeTab === 'respawn' && (
              <>
                {!capabilities.canManageRespawn && (
                  <p className="admin-dashboard__no-players">{t('adminDashboard.noPermission')}</p>
                )}

                {capabilities.canManageRespawn && (
                  <RespawnPanel
                    downedPlayers={downedPlayers}
                    moderationReason={moderationReason}
                    onModerationReasonChange={setModerationReason}
                    onRevivePlayer={(userId) => void revivePlayer(userId)}
                    nowTs={nowTs}
                    statusMsg={statusMsg}
                    loading={loading}
                  />
                )}
              </>
            )}

            {activeTab === 'events' && (
              <>
                {!capabilities.canViewLogs && (
                  <p className="admin-dashboard__no-players">{t('adminDashboard.logsDisabled')}</p>
                )}

                {capabilities.canViewLogs && (
                  <EventsPanel
                    revivalEvents={revivalEvents}
                    eventTypeFilter={eventTypeFilter}
                    onEventTypeFilterChange={setEventTypeFilter}
                    eventLimit={eventLimit}
                    onEventLimitChange={setEventLimit}
                    onRefresh={() => void fetchRevivalEvents()}
                    loading={loading}
                  />
                )}
              </>
            )}

              </>
            )}
          </main>

          <aside className="admin-dashboard__rightbar">
            <div className="admin-dashboard__player-summary-card">
              <div className="admin-dashboard__player-summary-label">{t('adminDashboard.players')}</div>
              <div className="admin-dashboard__player-summary-value">
                {status?.online ?? 0}<span className="admin-dashboard__player-summary-max">/{status?.maxPlayers ?? '?'}</span>
              </div>
            </div>

            <div className="admin-dashboard__rightbar-card">
              <input
                className="admin-dashboard__player-search"
                type="text"
                placeholder={t('adminDashboard.searchPlaceholder')}
                aria-label={t('adminDashboard.searchPlaceholder')}
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
              />

              {visibleRailPlayers.length === 0 ? (
                <p className="admin-dashboard__rightbar-empty">{t('adminDashboard.noPlayers')}</p>
              ) : (
                <div className="admin-dashboard__player-rail">
                  {visibleRailPlayers.map((player) => (
                    <button
                      key={player.userId}
                      type="button"
                      className="admin-dashboard__player-rail-item"
                      onClick={() => setActiveTab('players')}
                    >
                      <span className="admin-dashboard__player-rail-name">{player.actorName || `userId=${player.userId}`}</span>
                      <span className="admin-dashboard__player-rail-meta">ID {player.userId}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
