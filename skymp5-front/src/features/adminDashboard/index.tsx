import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FrameButton } from '../../components/FrameButton/FrameButton';
import { filterAdminPlayers, formatAdminPos, formatAdminTime, formatAdminUptime } from './utils';
import './styles.scss';

type Tab = 'overview' | 'players' | 'console' | 'logs' | 'metrics';
type AdminRole = 'admin' | 'moderator' | 'viewer';

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
  type: 'kick' | 'ban' | 'mute' | 'console';
  message: string;
}

interface MutedUserEntry {
  userId: number;
  expiresAt: number;
  remainingSec: number;
}

interface FrontendMetricEntry {
  name: string;
  value: number;
  source: string;
  ts: number;
  receivedAt: number;
  url?: string;
}

interface FrontendMetricsSummary {
  totalCount: number;
  errorCount: number;
  lastReceivedAt: number | null;
  averageValue: number;
  sources: Array<{ name: string; count: number }>;
  names: Array<{ name: string; count: number }>;
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
}

const DEFAULT_CAPABILITIES: AdminCapabilities = {
  canKick: true,
  canBan: true,
  canUnban: true,
  canConsole: true,
  canViewLogs: true,
  canMessage: true,
  canMute: true,
  canUnmute: true,
};

const EMPTY_FRONTEND_METRICS_SUMMARY: FrontendMetricsSummary = {
  totalCount: 0,
  errorCount: 0,
  lastReceivedAt: null,
  averageValue: 0,
  sources: [],
  names: [],
};

const REFRESH_INTERVAL_MS = 5000;
const ADMIN_DASHBOARD_STATE_KEY = 'skymp.adminDashboard.state.v1';

interface PersistedAdminDashboardState {
  activeTab?: Tab;
  playerSearch?: string;
  logTypeFilter?: '' | 'kick' | 'ban' | 'console';
  logLimit?: number;
  logSinceMinutes?: '' | '15' | '60' | '1440';
  metricLimit?: number;
  metricSourceFilter?: string;
  metricNameFilter?: string;
  consoleHistory?: string[];
}

const asRole = (value: unknown): AdminRole => {
  if (value === 'admin' || value === 'moderator' || value === 'viewer') return value;
  return 'viewer';
};

const AdminDashboard = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [bannedUserIds, setBannedUserIds] = useState<number[]>([]);
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
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logTypeFilter, setLogTypeFilter] = useState<'' | 'kick' | 'ban' | 'mute' | 'console'>('');
  const [logLimit, setLogLimit] = useState(100);
  const [logSinceMinutes, setLogSinceMinutes] = useState<'' | '15' | '60' | '1440'>('');
  const [logBeforeTs, setLogBeforeTs] = useState<number | null>(null);
  const [logHasMore, setLogHasMore] = useState(false);
  const [metricEntries, setMetricEntries] = useState<FrontendMetricEntry[]>([]);
  const [metricSummary, setMetricSummary] = useState<FrontendMetricsSummary>(EMPTY_FRONTEND_METRICS_SUMMARY);
  const [metricLimit, setMetricLimit] = useState(50);
  const [metricSourceFilter, setMetricSourceFilter] = useState('');
  const [metricNameFilter, setMetricNameFilter] = useState('');
  const [sendMsgTargetId, setSendMsgTargetId] = useState<number | null>(null);
  const [sendMsgTargetName, setSendMsgTargetName] = useState('');
  const [sendMsgText, setSendMsgText] = useState('');
  const [sendMsgSending, setSendMsgSending] = useState(false);
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

      if (persisted.activeTab && ['overview', 'players', 'console', 'logs', 'metrics'].includes(persisted.activeTab)) {
        setActiveTab(persisted.activeTab);
      }
      if (typeof persisted.playerSearch === 'string') setPlayerSearch(persisted.playerSearch);
      if (persisted.logTypeFilter === '' || persisted.logTypeFilter === 'kick' || persisted.logTypeFilter === 'ban' || persisted.logTypeFilter === 'console') {
        setLogTypeFilter(persisted.logTypeFilter);
      }
      if (persisted.logLimit && [25, 50, 100, 200].includes(persisted.logLimit)) setLogLimit(persisted.logLimit);
      if (persisted.logSinceMinutes === '' || persisted.logSinceMinutes === '15' || persisted.logSinceMinutes === '60' || persisted.logSinceMinutes === '1440') {
        setLogSinceMinutes(persisted.logSinceMinutes);
      }
      if (persisted.metricLimit && [25, 50, 100, 200].includes(persisted.metricLimit)) setMetricLimit(persisted.metricLimit);
      if (typeof persisted.metricSourceFilter === 'string') setMetricSourceFilter(persisted.metricSourceFilter);
      if (typeof persisted.metricNameFilter === 'string') setMetricNameFilter(persisted.metricNameFilter);
      if (Array.isArray(persisted.consoleHistory)) {
        setConsoleHistory(persisted.consoleHistory.filter((entry) => typeof entry === 'string').slice(0, 30));
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
        logLimit,
        logSinceMinutes,
        metricLimit,
        metricSourceFilter,
        metricNameFilter,
        consoleHistory,
      };
      window.localStorage.setItem(ADMIN_DASHBOARD_STATE_KEY, JSON.stringify(stateToPersist));
    } catch {
      // ignore storage write failures
    }
  }, [activeTab, consoleHistory, logLimit, logSinceMinutes, logTypeFilter, metricLimit, metricNameFilter, metricSourceFilter, playerSearch]);

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
      setBannedUserIds(Array.isArray(bans) ? bans : []);
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
  }, [capabilities.canViewLogs, logBeforeTs, logLimit, logSinceMinutes, logTypeFilter]);

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

  const kickPlayer = async (userId: number) => {
    try {
      const res = await fetch(`/api/admin/players/${userId}/kick`, { method: 'POST' });
      setForbiddenAwareStatus(res, `${t('adminDashboard.kicked')}: ${userId}`);
      if (res.ok) await fetchData();
    } catch {
      setStatusMsg(t('adminDashboard.apiError'));
    }
  };

  const banPlayer = async (userId: number) => {
    if (!window.confirm(`${t('adminDashboard.banConfirm')} userId=${userId}?`)) return;
    try {
      const res = await fetch(`/api/admin/players/${userId}/ban`, { method: 'POST' });
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
    setBannedUserIds([]);
    setMutedUsers([]);
    setStatusMsg('');
    setConsoleLines([]);
    setConsoleHistoryIndex(null);
    setLogEntries([]);
    setLogBeforeTs(null);
    setLogHasMore(false);
    setMetricEntries([]);
    setMetricSummary(EMPTY_FRONTEND_METRICS_SUMMARY);
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
    if (consoleEndRef.current) consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLines]);

  useEffect(() => {
    if (activeTab === 'logs') void fetchLogs();
    if (activeTab === 'metrics') void fetchFrontendMetrics();
  }, [activeTab, fetchFrontendMetrics, fetchLogs]);

  useEffect(() => {
    setLogBeforeTs(null);
  }, [logTypeFilter, logLimit, logSinceMinutes]);

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

  useEffect(() => {
    if (!visible || activeTab !== 'players' || mutedUsers.length === 0) return;
    const id = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [activeTab, mutedUsers.length, visible]);

  const metricSourceOptions = useMemo(() => metricSummary.sources.map((item) => item.name), [metricSummary.sources]);

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
    setLogLimit(100);
    setLogSinceMinutes('');
    setLogBeforeTs(null);
    setMetricLimit(50);
    setMetricSourceFilter('');
    setMetricNameFilter('');
    setConsoleHistory([]);
    setConsoleHistoryIndex(null);
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
  ];

  if (!visible) return <></>;

  return (
    <div className="admin-overlay" role="dialog" aria-modal="true" aria-label={t('adminDashboard.title')}>
      <div className="admin-dashboard">
        <div className="admin-dashboard__header">
          <div className="admin-dashboard__header-text">
            <h1 className="admin-dashboard__title">
              {status?.name ? `${t('adminDashboard.title')} — ${status.name}` : t('adminDashboard.title')}
            </h1>
            <p className="admin-dashboard__subtitle">{t('adminDashboard.subtitle')}</p>
          </div>
          <div className="admin-dashboard__header-meta">
            <span className={`admin-dashboard__role admin-dashboard__role--${adminRole}`}>
              {t('adminDashboard.role')}: {t(`adminDashboard.role_${adminRole}`)}
            </span>
            {lastUpdated && <span className="admin-dashboard__updated">{t('adminDashboard.updated')}: {lastUpdated}</span>}
            <FrameButton name="closeAdmin" text={t('adminDashboard.exit')} variant="DEFAULT" width={120} height={44} onClick={hide} />
          </div>
        </div>

        {loading && <div className="admin-dashboard__loading">{t('adminDashboard.loading')}</div>}

        {!loading && (
          <>
            {status && (
              <div className="admin-dashboard__stats-grid">
                <div className="admin-dashboard__stat-card">
                  <div className="admin-dashboard__stat-label">{t('adminDashboard.online')}</div>
                  <div className="admin-dashboard__stat-value admin-dashboard__stat-value--accent">{status.online}</div>
                </div>
                <div className="admin-dashboard__stat-card">
                  <div className="admin-dashboard__stat-label">{t('adminDashboard.maxPlayers')}</div>
                  <div className="admin-dashboard__stat-value">{status.maxPlayers}</div>
                </div>
                <div className="admin-dashboard__stat-card">
                  <div className="admin-dashboard__stat-label">{t('adminDashboard.port')}</div>
                  <div className="admin-dashboard__stat-value">{status.port}</div>
                </div>
                <div className="admin-dashboard__stat-card">
                  <div className="admin-dashboard__stat-label">{t('adminDashboard.uptime')}</div>
                  <div className="admin-dashboard__stat-value">{formatAdminUptime(status.uptimeSec)}</div>
                </div>
              </div>
            )}

            <div className="admin-dashboard__tabs" role="tablist" aria-label={t('adminDashboard.title')}>
              {tabs.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  id={`admin-tab-${key}`}
                  data-testid={`admin-tab-${key}`}
                  role="tab"
                  aria-selected={activeTab === key}
                  aria-controls={`admin-panel-${key}`}
                  className={`admin-dashboard__tab${activeTab === key ? ' admin-dashboard__tab--active' : ''}`}
                  onClick={() => setActiveTab(key)}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                className="admin-dashboard__prefs-reset-btn"
                onClick={resetDashboardPreferences}
              >
                {t('adminDashboard.resetView')}
              </button>
            </div>

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
                    {bannedUserIds.length === 0 ? (
                      <p className="admin-dashboard__bans-empty">{t('adminDashboard.noBans')}</p>
                    ) : (
                      <div className="admin-dashboard__bans-list">
                        {bannedUserIds.map((userId) => (
                          <div key={userId} className="admin-dashboard__ban-row">
                            <span className="admin-dashboard__ban-user">userId: {userId}</span>
                            <button
                              type="button"
                              className="admin-dashboard__unban-btn"
                              onClick={() => unbanPlayer(userId)}
                              disabled={!capabilities.canUnban}
                              title={!capabilities.canUnban ? t('adminDashboard.noPermission') : undefined}
                            >
                              {t('adminDashboard.unban')}
                            </button>
                          </div>
                        ))}
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
                    </div>

                    <div className="admin-dashboard__log-filters">
                      {(['', 'kick', 'ban', 'mute', 'console'] as const).map((type) => (
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

                    <div className="admin-dashboard__log-pagination">
                      <button type="button" className="admin-dashboard__log-page-btn" onClick={openRecentLogs} disabled={logBeforeTs === null}>
                        {t('adminDashboard.logRecent')}
                      </button>
                      <button type="button" className="admin-dashboard__log-page-btn" onClick={openOlderLogs} disabled={!logHasMore || oldestLogTs === null}>
                        {t('adminDashboard.logOlder')}
                      </button>
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
                              {entry.url && <span>{entry.url}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
