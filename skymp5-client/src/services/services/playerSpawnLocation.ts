import type { Transform } from '../../sync/movement';

interface SpawnReference {
  getParentCell(): { isInterior(): boolean; getFormID(): number } | null;
  getWorldSpace(): { getFormID(): number } | null;
  getPositionX(): number;
  getPositionY(): number;
  getPositionZ(): number;
}

interface SpawnRestoration {
  isCurrent(): boolean;
  getPlayer(): SpawnReference | null;
  movePlayer(target: Transform): void;
  wait(): Promise<void>;
  onError(error: unknown): void;
}

export function isAtSpawnLocation(player: SpawnReference, target: Transform): boolean {
  const cell = player.getParentCell();
  const location = cell?.isInterior() ? cell : player.getWorldSpace() || cell;
  if (!location || location.getFormID() !== target.worldOrCell) return false;
  const current = [player.getPositionX(), player.getPositionY(), player.getPositionZ()];
  return current.every(Number.isFinite) && current.reduce((sum, value, index) =>
    sum + Math.pow(value - target.pos[index], 2), 0) < 128 * 128;
}

// A template save can initially load at its own location. Wait for the
// authoritative server transform before allowing local movement back upstream.
export async function restorePlayerSpawn(target: Transform, context: SpawnRestoration): Promise<boolean> {
  let reportedError: string | undefined;
  while (context.isCurrent()) {
    try {
      const player = context.getPlayer();
      if (player) {
        if (isAtSpawnLocation(player, target)) return true;
        context.movePlayer(target);
      }
    } catch (error) {
      const message = String(error);
      if (message !== reportedError) { reportedError = message; context.onError(error); }
    }
    await context.wait();
  }
  return false;
}
