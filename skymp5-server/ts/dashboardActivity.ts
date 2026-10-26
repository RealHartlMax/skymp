import * as fs from 'fs';
import * as path from 'path';

interface Drop { ts: number; type: 'expected' | 'unexpected'; reason: string }
// The persistent web process stores aggregate-relevant data only: no IPs,
// identities or authentication material. Game restarts keep this history.
export class DashboardActivity {
  private drops: Drop[] = [];
  private since: number;
  private timer?: NodeJS.Timeout;
  private dirty = false;
  persistenceAvailable = true;
  constructor(private file: string, private now: () => number = Date.now) {
    this.since = now();
    try {
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (data.version !== 1 || !Number.isFinite(data.since) || !Array.isArray(data.drops) || data.drops.length > 5000 || data.drops.some((value: any) => !this.valid(value))) throw Error();
        this.since = Math.min(now(), data.since); this.drops = data.drops;
      }
    } catch { this.persistenceAvailable = false; }
  }
  private valid(value: any): boolean { return Number.isFinite(value?.ts) && value.ts >= 0 && value.ts <= this.now() + 5000 && ['expected', 'unexpected'].includes(value.type) && typeof value.reason === 'string' && value.reason.length <= 160; }
  record(value: any): void {
    const drop = { ts: value?.ts, type: value?.type, reason: typeof value?.reason === 'string' ? value.reason.slice(0, 160) : '' };
    if (!this.valid(drop)) return;
    this.drops = this.drops.filter(entry => entry.ts >= this.now() - 6 * 3600000);
    this.drops.push(drop);
    if (this.drops.length > 5000) { const removed = this.drops.shift()!; this.since = Math.max(this.since, removed.ts); }
    this.dirty = true;
    if (!this.timer) { this.timer = setTimeout(() => { this.timer = undefined; this.flush(); }, 2000); this.timer.unref(); }
  }
  view() {
    const from = this.now() - 6 * 3600000, entries = this.drops.filter(entry => entry.ts >= from && entry.ts <= this.now());
    const reasons = new Map<string, number>();
    for (const entry of entries.filter(entry => entry.type === 'unexpected')) reasons.set(entry.reason, (reasons.get(entry.reason) || 0) + 1);
    return { from, to: this.now(), observedFrom: Math.max(from, this.since), total: entries.length, expected: entries.filter(entry => entry.type === 'expected').length,
      unexpected: entries.filter(entry => entry.type === 'unexpected').length, reasons: [...reasons].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 5), persistenceAvailable: this.persistenceAvailable };
  }
  flush(): void {
    if (!this.dirty || !this.persistenceAvailable) return;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file + '.tmp', JSON.stringify({ version: 1, since: this.since, drops: this.drops.filter(entry => entry.ts >= this.now() - 6 * 3600000) }) + '\n', { mode: 0o600 });
      fs.renameSync(this.file + '.tmp', this.file); this.dirty = false;
    } catch { this.persistenceAvailable = false; }
  }
  close(): void { clearTimeout(this.timer); this.flush(); }
}
