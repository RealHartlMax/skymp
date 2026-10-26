import Axios from 'axios';
import { describeServerAssets } from '../serverAssets';

import {
  DEFAULT_TIMEOUT_MS,
  MAX_REQUEST_BODY_BYTES,
  MAX_RESPONSE_BODY_BYTES,
} from '../lib/axiosDefaults';
import { ScampServer } from '../scampNative';
import { Log, System } from './system';
import { SystemContext } from './system';

interface MasterHeartbeatPayload {
  name: string;
  ip: string;
  port: number;
  maxPlayers: number;
  online: number;
  gamemode?: string;
  countryCode?: string;
  server_uid?: string;
}

export class MasterClient implements System {
  systemName = 'MasterClient';

  constructor(
    private log: Log,
    private serverPort: number,
    private serverIp: string,
    private masterUrl: string | null,
    private maxPlayers: number,
    private name: string,
    private masterKey: string,
    updateIntervalMs = 15000,
    private offlineMode = false,
    private gamemode?: string,
    private countryCode?: string,
    private serverUid?: string,
  ) {
    this.updateIntervalMs =
      MasterClient.clampHeartbeatInterval(updateIntervalMs);
  }

  private readonly updateIntervalMs: number;

  async initAsync(): Promise<void> {
    if (this.offlineMode) {
      this.log('Master server heartbeat is disabled in offline mode');
      return;
    }

    if (!this.masterUrl) {
      this.log('No master server specified');
      return;
    }

    const base = this.masterUrl.trim().replace(/\/+$/, '');
    try {
      const url = new URL(base);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw Error('Invalid master URL');
    } catch {
      this.log('[MasterClient] Invalid master URL. Use an HTTP(S) origin without credentials, query or fragment.');
      return;
    }
    const privateKey = String(this.masterKey || '').trim();
    if (!/^[a-zA-Z0-9_-]{12,128}$/.test(privateKey)) {
      this.log('[MasterClient] Missing or invalid private server key. Copy it from Launcher & online authentication in the dashboard.');
      return;
    }
    this.endpoint = base + '/api/servers/' + encodeURIComponent(privateKey);
    this.log('[MasterClient] Using dashboard master ' + base + '; public server ID: ' + (this.serverUid || 'resolved from private key'));

    await this.sendHeartbeat(0, 'initial');

    process.once('SIGINT', () => {
      void this.sendHeartbeat(0, 'shutdown');
    });
    process.once('SIGTERM', () => {
      void this.sendHeartbeat(0, 'shutdown');
    });
  }

  update(): void {
    return;
  }

  async updateAsync(ctx: SystemContext): Promise<void> {
    if (this.offlineMode) {
      return;
    }

    await new Promise((r) => setTimeout(r, this.updateIntervalMs));

    await this.sendHeartbeat(this.getCurrentOnline(ctx.svr), 'periodic');
  }

  // connect/disconnect events are not reliable so we do full recalculate
  private getCurrentOnline(svr: ScampServer): number {
    return (svr as any).get(0, 'onlinePlayers').length;
  }

  customPacket(): void {
    return;
  }

  private buildPayload(online: number): MasterHeartbeatPayload {
    const payload: MasterHeartbeatPayload = {
      name: this.name,
      ip: this.serverIp,
      port: this.serverPort,
      maxPlayers: this.maxPlayers,
      online,
    };

    if (this.gamemode) {
      payload.gamemode = this.gamemode;
    }
    if (this.countryCode) {
      payload.countryCode = this.countryCode;
    }
    if (this.serverUid) {
      payload.server_uid = this.serverUid;
    }

    return payload;
  }

  private async sendHeartbeat(
    online: number,
    reason: 'initial' | 'periodic' | 'shutdown',
  ): Promise<void> {
    if (!this.endpoint) {
      return;
    }

    const payload = { ...this.buildPayload(online), serverStatus: reason === 'shutdown' ? 'offline' : 'online', assets: await describeServerAssets() };
    const maxAttempts = 4;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await Axios.post(this.endpoint, payload, {
          timeout: DEFAULT_TIMEOUT_MS,
          maxBodyLength: MAX_REQUEST_BODY_BYTES,
          maxContentLength: MAX_RESPONSE_BODY_BYTES,
        });
        const now = Date.now();
        if (reason !== 'periodic' || this.hadHeartbeatFailure || now - this.lastSuccessLog >= 5 * 60 * 1000) {
          this.log('[MasterClient] Heartbeat ' + reason + ' accepted (HTTP ' + response.status + ', public ID=' + (this.serverUid || 'dashboard') + ', host=' + this.serverIp + ':' + this.serverPort + ', players=' + online + ').');
          this.lastSuccessLog = now;
        }
        this.hadHeartbeatFailure = false;
        return;
      } catch (error) {
        this.hadHeartbeatFailure = true;
        if (Axios.isAxiosError(error)) {
          if (error.response) {
            const body = this.safeError(error.response.data);
            this.log(
              `[MasterClient] Heartbeat ${reason} failed with status=${error.response.status}, body=${body}`,
            );
            if (error.response.status === 404) {
              this.log('[MasterClient] Check the API webroot: api/servers/index.php must delegate to the dashboard-backed native master. Then verify the dashboard server entry and private key.');
            } else if (error.response.status === 401) {
              this.log('[MasterClient] The dashboard did not accept the private server key. Use the current key of your registered server; the public server ID is a different value.');
            } else if (error.response.status === 400) {
              this.log('[MasterClient] Check serverUid against the public dashboard ID and check player limits.');
            }
            return;
          }

          const message = this.safeError(error.message || 'network error');
          this.log(
            `[MasterClient] Heartbeat ${reason} network error on attempt ${attempt}/${maxAttempts}: ${message}`,
          );
        } else {
          this.log(
            `[MasterClient] Heartbeat ${reason} failed on attempt ${attempt}/${maxAttempts}: ${String(
              this.safeError(error),
            )}`,
          );
        }

        if (attempt >= maxAttempts) {
          return;
        }

        const delayMs = MasterClient.getRetryDelayMs(attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  private static getRetryDelayMs(attempt: number): number {
    const baseMs = 500;
    const jitter = Math.floor(Math.random() * 250);
    return Math.min(5000, baseMs * 2 ** (attempt - 1)) + jitter;
  }

  private static clampHeartbeatInterval(value: number): number {
    if (!Number.isFinite(value)) {
      return 15000;
    }
    return Math.max(10000, Math.min(30000, Math.floor(value)));
  }

  private safeError(value: unknown): string {
    const text = typeof value === 'string' ? value : JSON.stringify(value) || String(value);
    const key = this.masterKey.trim();
    return (key ? text.split(key).join('[redacted]') : text).slice(0, 1000);
  }

  private hadHeartbeatFailure = false;
  private lastSuccessLog = 0;
  private endpoint: string | null = null;
}
