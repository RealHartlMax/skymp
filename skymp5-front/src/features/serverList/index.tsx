import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FrameButton } from '../../components/FrameButton/FrameButton';
import { pingClass, pingLabel, isValidPort } from './utils';
import './styles.scss';

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

type SortKey = 'name' | 'players' | 'ping';

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
  const [directIp, setDirectIp] = useState('');
  const [directPort, setDirectPort] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchServers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/servers');
      if (!res.ok) throw new Error('api');
      const data: ServerEntry[] = await res.json();
      setServers(data);
    } catch {
      // Fallback: demo data when no API available
      setServers([
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
          tags: ['pve', 'crafting', 'economy'],
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
          tags: ['pvp', 'competitive'],
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
          tags: ['rp', 'immersive'],
          online: true,
          passwordProtected: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  const show = useCallback(async () => {
    setVisible(true);
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

  const connect = useCallback((server: ServerEntry) => {
    window.dispatchEvent(
      new CustomEvent('serverList:connect', {
        detail: { ip: server.ip, port: server.port }
      })
    );
    hide();
  }, [hide]);

  const connectDirect = () => {
    const ip = directIp.trim();
    const port = parseInt(directPort.trim(), 10);
    if (!ip || !isValidPort(port)) {
      setError(t('serverList.invalidAddress'));
      return;
    }
    window.dispatchEvent(
      new CustomEvent('serverList:connect', { detail: { ip, port } })
    );
    hide();
  };

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

  const filtered = servers
    .filter((s) => {
      if (!showFull && s.players >= s.maxPlayers) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.ip.includes(q);
    })
    .sort((a, b) => {
      if (sortKey === 'players') return b.players - a.players;
      if (sortKey === 'ping') {
        if (a.ping === null) return 1;
        if (b.ping === null) return -1;
        return a.ping - b.ping;
      }
      return a.name.localeCompare(b.name);
    });

  if (!visible) return <></>;

  return (
    <div className="server-overlay">
      <div className="server-list">

        {/* Header */}
        <div className="server-list__header">
          <div className="server-list__header-text">
            <h1 className="server-list__title">{t('serverList.title')}</h1>
            <p className="server-list__subtitle">{t('serverList.subtitle')}</p>
          </div>
          <FrameButton
            name="closeServerList"
            text={t('serverList.exit')}
            variant="DEFAULT"
            width={120}
            height={44}
            onClick={hide}
          />
        </div>

        {/* Controls */}
        <div className="server-list__controls">
          <input
            ref={searchRef}
            className="server-list__search"
            type="text"
            placeholder={t('serverList.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="server-list__sort">
            <span className="server-list__sort-label">{t('serverList.sortBy')}:</span>
            {(['players', 'ping', 'name'] as SortKey[]).map((key) => (
              <button
                key={key}
                className={`server-list__sort-btn ${sortKey === key ? 'server-list__sort-btn--active' : ''}`}
                onClick={() => setSortKey(key)}
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
        </div>

        {/* Server table */}
        <div className="server-list__main">
          <div className="server-list__table-wrap">
            {loading && (
              <div className="server-list__loading">{t('serverList.loading')}</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="server-list__empty">{t('serverList.noServers')}</div>
            )}
            {!loading && filtered.length > 0 && (
              <table className="server-list__table">
                <thead>
                  <tr>
                    <th>{t('serverList.colName')}</th>
                    <th>{t('serverList.colPlayers')}</th>
                    <th>{t('serverList.colPing')}</th>
                    <th>{t('serverList.colVersion')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((server) => (
                    <tr
                      key={server.id}
                      className={`server-list__row ${selected?.id === server.id ? 'server-list__row--selected' : ''}`}
                      onClick={() => setSelected(server)}
                      onDoubleClick={() => connect(server)}
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
                      <td>
                        <button
                          className="server-list__connect-btn"
                          onClick={(e) => { e.stopPropagation(); connect(server); }}
                        >
                          {t('serverList.connect')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Details panel */}
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

        {/* Direct connect */}
        <div className="server-list__direct">
          <span className="server-list__direct-label">{t('serverList.directConnect')}:</span>
          <input
            className="server-list__direct-input"
            type="text"
            placeholder={t('serverList.directIpPlaceholder')}
            value={directIp}
            onChange={(e) => setDirectIp(e.target.value)}
          />
          <input
            className="server-list__direct-input server-list__direct-input--port"
            type="number"
            placeholder={t('serverList.directPortPlaceholder')}
            value={directPort}
            onChange={(e) => setDirectPort(e.target.value)}
            min={1}
            max={65535}
          />
          <button className="server-list__direct-btn" onClick={connectDirect}>
            {t('serverList.connect')}
          </button>
        </div>

        {error && <div className="server-list__error">{error}</div>}
      </div>
    </div>
  );
};

export default ServerList;
