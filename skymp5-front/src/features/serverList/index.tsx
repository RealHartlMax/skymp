import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FrameButton } from '../../components/FrameButton/FrameButton';
import { collectServerTags, getVisibleServers, isValidHostOrIp, isValidPort, pingClass, pingLabel, SortKey } from './utils';
import { fetchServerList } from './api';
import {
  getAutoConnectLast,
  getCachedServers,
  getFavoriteServerIds,
  getLastServerRef,
  getLauncherApiEndpoint,
  getLauncherDarkMode,
  setAutoConnectLast,
  setCachedServers,
  setFavoriteServerIds,
  setLastServerRef,
  setLauncherApiEndpoint,
  setLauncherDarkMode,
} from './preferences';
import './styles.scss';

const CLIENT_VERSION = '1.0.0';

interface ServerEntry {
  id: string;
  name: string;
  ip: string;
  port: number;
  players: number;
  maxPlayers: number;
  ping: number | null;
  version: string;
  description?: string;
  tags?: string[];
  online: boolean;
  passwordProtected?: boolean;
}

type ServerSource = 'api' | 'cache' | 'demo';

const demoServers: ServerEntry[] = [
  {
    id: 'demo-1',
    name: 'SkyMP Main Server',
    ip: '127.0.0.1',
    port: 7777,
    players: 42,
    maxPlayers: 100,
    ping: 24,
    version: '1.0.0',
    description: 'Official SkyMP server. PvE, crafting, economy.',
    tags: ['pve', 'crafting', 'economy', 'eu'],
    online: true,
    passwordProtected: false
  },
  {
    id: 'demo-2',
    name: 'SkyMP PvP Arena',
    ip: '127.0.0.1',
    port: 7778,
    players: 15,
    maxPlayers: 50,
    ping: 68,
    version: '1.0.0',
    description: 'Competitive PvP server with ranking system.',
    tags: ['pvp', 'competitive', 'na'],
    online: true,
    passwordProtected: false
  },
  {
    id: 'demo-3',
    name: 'Roleplay Skyrim',
    ip: '127.0.0.1',
    port: 7779,
    players: 8,
    maxPlayers: 30,
    ping: 145,
    version: '1.0.0',
    description: 'Immersive roleplay experience.',
    tags: ['rp', 'immersive', 'eu'],
    online: true,
    passwordProtected: true
  }
];

const resolveInitialTheme = (): boolean => {
  const stored = getLauncherDarkMode();
  if (stored !== null) return stored;

  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  return true;
};

const ServerList = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [selected, setSelected] = useState<ServerEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('players');
  const [showFull, setShowFull] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [tagFilter, setTagFilter] = useState('');
  const [directIp, setDirectIp] = useState('');
  const [directPort, setDirectPort] = useState('');
  const [favoriteIds, setFavoriteIdsState] = useState<string[]>(getFavoriteServerIds());
  const [autoConnectLast, setAutoConnectLastState] = useState(getAutoConnectLast());
  const [apiEndpointInput, setApiEndpointInput] = useState(getLauncherApiEndpoint());
  const [apiEndpoint, setApiEndpoint] = useState(getLauncherApiEndpoint());
  const [serverSource, setServerSource] = useState<ServerSource>('demo');
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [isDarkMode, setIsDarkMode] = useState(resolveInitialTheme());
  const [didAutoConnect, setDidAutoConnect] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [updateBannerVersion, setUpdateBannerVersion] = useState<string | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const availableTags = useMemo(() => collectServerTags(servers), [servers]);

  useEffect(() => {
    document.body.classList.toggle('skymp-theme-light', !isDarkMode);
    document.body.classList.toggle('skymp-theme-dark', isDarkMode);
    setLauncherDarkMode(isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const toggleFavorite = useCallback((serverId: string) => {
    setFavoriteIdsState((prev) => {
      const next = prev.includes(serverId)
        ? prev.filter((id) => id !== serverId)
        : [...prev, serverId];
      setFavoriteServerIds(next);
      return next;
    });
  }, []);

  const connect = useCallback((server: ServerEntry) => {
    setLastServerRef({ id: server.id, ip: server.ip, port: server.port });
    window.dispatchEvent(
      new CustomEvent('serverList:connect', {
        detail: { ip: server.ip, port: server.port }
      })
    );
    setVisible(false);
  }, []);

  const connectDirect = useCallback(() => {
    const host = directIp.trim();
    const port = parseInt(directPort.trim(), 10);
    if (!isValidHostOrIp(host) || !isValidPort(port)) {
      setError(t('serverList.invalidAddress'));
      return;
    }

    setLastServerRef({ ip: host, port });
    window.dispatchEvent(
      new CustomEvent('serverList:connect', { detail: { ip: host, port } })
    );
    setVisible(false);
  }, [directIp, directPort, t]);

  const fetchServers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await fetchServerList(apiEndpoint);
      setServers(data);
      setCachedServers(data);
      setServerSource('api');

      if (!selected && data.length > 0) {
        setSelected(data[0]);
      }
    } catch {
      const cached = getCachedServers();
      if (cached.length > 0) {
        setServers(cached);
        setServerSource('cache');
        setError(t('serverList.offlineCacheUsed'));
        if (!selected) setSelected(cached[0]);
      } else {
        setServers(demoServers);
        setServerSource('demo');
        setError(t('serverList.offlineDemoUsed'));
        if (!selected) setSelected(demoServers[0]);
      }
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, selected, t]);

  const runAutoConnectIfNeeded = useCallback((serverList: ServerEntry[]) => {
    if (!autoConnectLast || didAutoConnect) return;

    const last = getLastServerRef();
    if (!last) return;

    const match = serverList.find((item) => (
      (last.id && item.id === last.id)
      || (item.ip === last.ip && item.port === last.port)
    ));

    if (match) {
      setDidAutoConnect(true);
      connect(match);
    }
  }, [autoConnectLast, connect, didAutoConnect]);

  useEffect(() => {
    if (servers.length > 0 && visible) {
      runAutoConnectIfNeeded(servers);
    }
  }, [servers, visible, runAutoConnectIfNeeded]);

  const show = useCallback(async () => {
    setVisible(true);
    setDidAutoConnect(false);
    setUpdateBannerVersion(null);
    setUpdateDismissed(false);
    void checkForUpdate();
    await fetchServers();
    setTimeout(() => searchRef.current?.focus(), 100);
  }, [fetchServers]);

  const hide = useCallback(() => {
    setVisible(false);
    setSelected(null);
    setSearch('');
    setDirectIp('');
    setDirectPort('');
    setError('');
  }, []);

  const checkForUpdate = useCallback(async () => {
    try {
      const res = await fetch('/api/update/latest');
      if (!res.ok) return;
      const data = await res.json() as { version?: string };
      if (data?.version && data.version !== CLIENT_VERSION) {
        setUpdateBannerVersion(data.version);
      }
    } catch {
      // ignore — graceful degradation
    }
  }, []);

  const versionMismatch =
    selected !== null &&
    selected.version &&
    selected.version !== CLIENT_VERSION &&
    selected.version !== '0.0.0';

  const applyApiEndpoint = useCallback(() => {
    const normalized = apiEndpointInput.trim();
    if (!normalized) {
      setError(t('serverList.invalidApiEndpoint'));
      return;
    }

    setLauncherApiEndpoint(normalized);
    setApiEndpoint(normalized);
    setError('');
    void fetchServers();
  }, [apiEndpointInput, fetchServers, t]);

  useEffect(() => {
    const onShow = () => void show();
    const onHide = () => hide();
    window.addEventListener('showServerList', onShow);
    window.addEventListener('hideServerList', onHide);
    return () => {
      window.removeEventListener('showServerList', onShow);
      window.removeEventListener('hideServerList', onHide);
    };
  }, [show, hide]);

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

  const filtered = getVisibleServers(servers, search, sortKey, showFull, {
    favoriteIds: favoriteSet,
    onlyFavorites,
    requiredTag: tagFilter,
  });

  if (!visible) return <></>;

  return (
    <div className="server-overlay" role="dialog" aria-modal="true" aria-label={t('serverList.title')}>
      <div className={`server-list ${isDarkMode ? 'server-list--dark' : 'server-list--light'}`}>
        <div className="server-list__header">
          <div className="server-list__header-text">
            <h1 className="server-list__title">{t('serverList.title')}</h1>
            <p className="server-list__subtitle">{t('serverList.subtitle')}</p>
          </div>
          <div className="server-list__header-actions">
            <button
              type="button"
              className="server-list__theme-btn"
              onClick={() => setIsDarkMode((prev) => !prev)}
              aria-label={t('serverList.toggleTheme')}
            >
              {isDarkMode ? t('serverList.themeLight') : t('serverList.themeDark')}
            </button>
            <FrameButton
              name="closeServerList"
              text={t('serverList.exit')}
              variant="DEFAULT"
              width={120}
              height={44}
              onClick={hide}
            />
          </div>
        </div>

        <div className="server-list__status-row" aria-live="polite" role="status">
          <span className={`server-list__status-pill server-list__status-pill--${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? t('serverList.onlineStatus') : t('serverList.offlineStatus')}
          </span>
          <span className="server-list__status-pill">{t(`serverList.source_${serverSource}`)}</span>
          <label className="server-list__auto-connect">
            <input
              type="checkbox"
              checked={autoConnectLast}
              onChange={(e) => {
                const value = e.target.checked;
                setAutoConnectLastState(value);
                setAutoConnectLast(value);
              }}
            />
            {t('serverList.autoConnectLast')}
          </label>
        </div>

        <div className="server-list__api-row">
          <input
            className="server-list__api-input"
            type="text"
            value={apiEndpointInput}
            onChange={(e) => setApiEndpointInput(e.target.value)}
            placeholder={t('serverList.apiEndpointPlaceholder')}
            aria-label={t('serverList.apiEndpoint')}
          />
          <button type="button" className="server-list__api-apply" onClick={applyApiEndpoint}>
            {t('serverList.applyApiEndpoint')}
          </button>
        </div>

        <div className="server-list__controls">
          <input
            ref={searchRef}
            className="server-list__search"
            type="text"
            placeholder={t('serverList.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('serverList.searchPlaceholder')}
          />
          <div className="server-list__sort">
            <span className="server-list__sort-label">{t('serverList.sortBy')}:</span>
            {(['players', 'ping', 'name'] as SortKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`server-list__sort-btn ${sortKey === key ? 'server-list__sort-btn--active' : ''}`}
                onClick={() => setSortKey(key)}
                aria-pressed={sortKey === key}
              >
                {t(`serverList.sort_${key}`)}
              </button>
            ))}
          </div>

          <label className="server-list__filter-full">
            <input
              type="checkbox"
              checked={showFull}
              onChange={(e) => setShowFull(e.target.checked)}
            />
            {t('serverList.showFull')}
          </label>

          <label className="server-list__filter-full">
            <input
              type="checkbox"
              checked={onlyFavorites}
              onChange={(e) => setOnlyFavorites(e.target.checked)}
            />
            {t('serverList.onlyFavorites')}
          </label>

          <select
            className="server-list__tag-filter"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            aria-label={t('serverList.filterByTag')}
          >
            <option value="">{t('serverList.allTags')}</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>

        <div className="server-list__main">
          <div className="server-list__table-wrap">
            {loading && <div className="server-list__loading">{t('serverList.loading')}</div>}
            {!loading && filtered.length === 0 && <div className="server-list__empty">{t('serverList.noServers')}</div>}
            {!loading && filtered.length > 0 && (
              <table className="server-list__table">
                <caption className="server-list__sr-only">{t('serverList.title')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('serverList.colName')}</th>
                    <th scope="col">{t('serverList.colPlayers')}</th>
                    <th scope="col">{t('serverList.colPing')}</th>
                    <th scope="col">{t('serverList.colVersion')}</th>
                    <th scope="col">{t('serverList.connect')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((server) => {
                    const isFavorite = favoriteSet.has(server.id);
                    return (
                      <tr
                        key={server.id}
                        className={`server-list__row ${selected?.id === server.id ? 'server-list__row--selected' : ''}`}
                        onClick={() => setSelected(server)}
                        onDoubleClick={() => connect(server)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') connect(server);
                          if (e.key.toLowerCase() === 'f') toggleFavorite(server.id);
                        }}
                        tabIndex={0}
                        aria-selected={selected?.id === server.id}
                        aria-label={`${server.name} ${server.players}/${server.maxPlayers}`}
                      >
                        <td className="server-list__col-name">
                          <span className={`server-list__dot ${server.online ? 'server-list__dot--online' : 'server-list__dot--offline'}`} />
                          {server.passwordProtected && (
                            <span className="server-list__lock" title={t('serverList.passwordProtected')}>🔒</span>
                          )}
                          <span className="server-list__name">{server.name}</span>
                          {server.tags && server.tags.map((tag) => (
                            <span key={tag} className="server-list__tag">{tag}</span>
                          ))}
                        </td>
                        <td className="server-list__col-players">
                          <span className={server.players >= server.maxPlayers ? 'server-list__players--full' : ''}>
                            {server.players}
                          </span>
                          <span className="server-list__players-max">/{server.maxPlayers}</span>
                        </td>
                        <td>
                          <span className={`server-list__ping ${pingClass(server.ping)}`}>
                            {pingLabel(server.ping)}
                          </span>
                        </td>
                        <td className="server-list__col-version">{server.version}</td>
                        <td className="server-list__actions-cell">
                          <button
                            type="button"
                            className={`server-list__favorite-btn ${isFavorite ? 'server-list__favorite-btn--active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(server.id);
                            }}
                            aria-label={isFavorite ? t('serverList.removeFavorite') : t('serverList.addFavorite')}
                          >
                            {isFavorite ? '★' : '☆'}
                          </button>
                          <button
                            type="button"
                            className="server-list__connect-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              connect(server);
                            }}
                          >
                            {t('serverList.connect')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {selected && (
            <div className="server-list__detail">
              <h3 className="server-list__detail-name">{selected.name}</h3>
              <div className="server-list__detail-row">
                <span>{t('serverList.detailIp')}:</span>
                <span>{selected.ip}:{selected.port}</span>
              </div>
              <div className="server-list__detail-row">
                <span>{t('serverList.colPlayers')}:</span>
                <span>{selected.players}/{selected.maxPlayers}</span>
              </div>
              <div className="server-list__detail-row">
                <span>{t('serverList.colPing')}:</span>
                <span className={`server-list__ping ${pingClass(selected.ping)}`}>
                  {pingLabel(selected.ping)}
                </span>
              </div>
              {selected.description && (
                <p className="server-list__detail-desc">{selected.description}</p>
              )}
              {versionMismatch && (
                <div className="server-list__version-warn" role="alert">
                  ⚠ {t('serverList.versionMismatch')}
                </div>
              )}
              <FrameButton
                name="connectSelected"
                text={t('serverList.connect')}
                variant="DEFAULT"
                width={220}
                height={48}
                onClick={() => connect(selected)}
              />
            </div>
          )}
        </div>

        <div className="server-list__direct">
          <span className="server-list__direct-label">{t('serverList.directConnect')}:</span>
          <input
            className="server-list__direct-input"
            type="text"
            placeholder={t('serverList.directIpPlaceholder')}
            value={directIp}
            onChange={(e) => setDirectIp(e.target.value)}
            aria-label={t('serverList.directIpPlaceholder')}
          />
          <input
            className="server-list__direct-input server-list__direct-input--port"
            type="number"
            placeholder={t('serverList.directPortPlaceholder')}
            value={directPort}
            onChange={(e) => setDirectPort(e.target.value)}
            min={1}
            max={65535}
            aria-label={t('serverList.directPortPlaceholder')}
          />
          <button type="button" className="server-list__direct-btn" onClick={connectDirect}>
            {t('serverList.connect')}
          </button>
        </div>

        {error && <div className="server-list__error" role="alert">{error}</div>}
      </div>
      {!updateDismissed && updateBannerVersion && (
        <div className="server-list__update-banner" role="status">
          <span>{t('serverList.updateAvailable', { version: updateBannerVersion })}</span>
          <button
            type="button"
            className="server-list__update-dismiss"
            onClick={() => setUpdateDismissed(true)}
          >
            {t('serverList.updateDismiss')}
          </button>
        </div>
      )}
    </div>
  );
};

export default ServerList;
