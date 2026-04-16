import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FrameButton } from '../../components/FrameButton/FrameButton';
import './styles.scss';

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
  name: string;
  ip: string;
  pos: PlayerPos;
}

const REFRESH_INTERVAL_MS = 5000;

const fmtUptime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
};

const fmtPos = (pos: PlayerPos): string => {
  if (!pos) return '–';
  return `${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)}`;
};

const AdminDashboard = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const kickPlayer = async (userId: number) => {
    try {
      const res = await fetch(`/api/admin/players/${userId}/kick`, { method: 'POST' });
      if (res.ok) {
        setStatusMsg(`${t('adminDashboard.kicked')}: ${userId}`);
        await fetchData();
      } else {
        setStatusMsg(t('adminDashboard.apiError'));
      }
    } catch {
      setStatusMsg(t('adminDashboard.apiError'));
    }
  };

  const show = useCallback(async () => {
    setVisible(true);
    setLoading(true);
    await fetchData();
    setLoading(false);
    intervalRef.current = setInterval(fetchData, REFRESH_INTERVAL_MS);
  }, [fetchData]);

  const hide = useCallback(() => {
    setVisible(false);
    setStatus(null);
    setPlayers([]);
    setStatusMsg('');
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
  }, [show, hide]);

  if (!visible) return <></>;

  return (
    <div className="admin-overlay">
      <div className="admin-dashboard">
        <div className="admin-dashboard__header">
          <div className="admin-dashboard__header-text">
            <h1 className="admin-dashboard__title">
              {status?.name ? `${t('adminDashboard.title')} — ${status.name}` : t('adminDashboard.title')}
            </h1>
            <p className="admin-dashboard__subtitle">{t('adminDashboard.subtitle')}</p>
          </div>
          <div className="admin-dashboard__header-meta">
            {lastUpdated && (
              <span className="admin-dashboard__updated">
                {t('adminDashboard.updated')}: {lastUpdated}
              </span>
            )}
            <FrameButton
              name="closeAdmin"
              text={t('adminDashboard.exit')}
              variant="DEFAULT"
              width={120}
              height={44}
              onClick={hide}
            />
          </div>
        </div>

        {loading && (
          <div className="admin-dashboard__loading">{t('adminDashboard.loading')}</div>
        )}

        {!loading && status && (
          <>
            <div className="admin-dashboard__stats-grid">
              <div className="admin-dashboard__stat-card">
                <div className="admin-dashboard__stat-label">{t('adminDashboard.online')}</div>
                <div className="admin-dashboard__stat-value admin-dashboard__stat-value--accent">
                  {status.online}
                </div>
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
                <div className="admin-dashboard__stat-value">{fmtUptime(status.uptimeSec)}</div>
              </div>
            </div>

            <div className="admin-dashboard__players-section">
              <h2 className="admin-dashboard__section-title">{t('adminDashboard.players')}</h2>
              {players.length === 0 ? (
                <p className="admin-dashboard__no-players">{t('adminDashboard.noPlayers')}</p>
              ) : (
                <div className="admin-dashboard__table-wrapper">
                  <table className="admin-dashboard__table">
                    <thead>
                      <tr>
                        <th>{t('adminDashboard.userId')}</th>
                        <th>{t('adminDashboard.actorId')}</th>
                        <th>{t('adminDashboard.name')}</th>
                        <th>{t('adminDashboard.ip')}</th>
                        <th>{t('adminDashboard.pos')}</th>
                        <th>{t('adminDashboard.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((player) => (
                        <tr key={player.userId}>
                          <td>{player.userId}</td>
                          <td>{player.actorId}</td>
                          <td>{player.name || '–'}</td>
                          <td>{player.ip}</td>
                          <td className="admin-dashboard__pos">{fmtPos(player.pos)}</td>
                          <td>
                            <button
                              className="admin-dashboard__kick-btn"
                              onClick={() => kickPlayer(player.userId)}
                            >
                              {t('adminDashboard.kick')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {statusMsg && (
          <div className="admin-dashboard__status-msg">{statusMsg}</div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
