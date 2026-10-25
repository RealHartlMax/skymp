export interface RuntimeMetrics {
  cpuPercent: number;
  rssBytes: number;
  heapUsedBytes: number;
  eventLoopMs: number;
}
export interface TickMetrics {
  count: number;
  totalMs: number;
  maxMs: number;
  buckets: number[];
}
export interface GamePerformanceSample {
  at: number;
  pid: number;
  players: number;
  runtime: RuntimeMetrics;
  ticks: TickMetrics;
}
export interface PerformancePoint {
  at: number;
  observedMs: number;
  runningMs: number;
  players: number | null;
  game: RuntimeMetrics | null;
  web: RuntimeMetrics | null;
  ticks: TickMetrics & { averageMs: number | null };
}
export interface PerformanceView {
  at: number;
  from: number;
  to: number;
  mode: 'dashboard' | 'standalone';
  gameState: string;
  gamePid: number | null;
  telemetryFresh: boolean;
  persistenceAvailable: boolean;
  bucketBoundsMs: (number | null)[];
  live: { players: number | null; game: RuntimeMetrics | null; web: RuntimeMetrics | null };
  histogram: TickMetrics;
  summary: { observedMs: number; runningPercent: number | null; medianPlayers: number | null; peakPlayers: number | null };
  points: PerformancePoint[];
}
