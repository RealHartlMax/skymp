export const WORLDS_MASTER = 'https://api.skymp-worlds.net';
export const LEGACY_MASTER = 'https://gateway.skymp.net';

export type LoginProvider = 'worlds' | 'legacy' | 'custom' | 'offline';
export interface LoginSettings {
  masterUrl: string;
  masterKey: string;
  serverUid: string;
  offlineMode: boolean;
  playerAccess?: { mode: 'guest' | 'account'; approvalRequired: boolean; steamApiKey: string; steamAppId: number };
}

export function getLoginProvider(master: string, offline: boolean): LoginProvider {
  if (offline) return 'offline';
  try {
    const origin = new URL(master).origin;
    if (origin === WORLDS_MASTER) return 'worlds';
    if (['https://gateway.skymp.net', 'https://cloud.skymp.net', 'https://skymp.net'].includes(origin)) return 'legacy';
  } catch { /* The custom field may be incomplete while being edited. */ }
  return 'custom';
}

function origin(value: string): string {
  try { return new URL(value).origin; } catch { return value.trim(); }
}

export function changeLoginMaster<T extends LoginSettings>(current: T, masterUrl: string): T {
  const changedService = origin(current.masterUrl) !== origin(masterUrl);
  // Credentials and public IDs belong to their issuing service. Never send a
  // Worlds key to the legacy service (or to a custom service) after a switch.
  return { ...current, masterUrl, ...(changedService ? { masterKey: '', serverUid: '' } : {}) };
}

export function selectLoginProvider<T extends LoginSettings>(current: T, provider: LoginProvider): T {
  if (provider === 'offline') return { ...current, offlineMode: true };
  const master = provider === 'worlds' ? WORLDS_MASTER : provider === 'legacy' ? LEGACY_MASTER : '';
  return { ...changeLoginMaster(current, master), offlineMode: false };
}

export function validateLoginSettings(settings: LoginSettings): 'invalidMaster' | 'missingKey' | 'missingServerId' | null {
  if (settings.offlineMode || settings.playerAccess?.mode === 'guest') return null;
  try {
    const url = new URL(settings.masterUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') return 'invalidMaster';
  } catch { return 'invalidMaster'; }
  if (!settings.masterKey.trim()) return 'missingKey';
  if (getLoginProvider(settings.masterUrl, false) === 'worlds' && !settings.serverUid.trim()) return 'missingServerId';
  return null;
}

export function normalizeJoinMode(value: unknown): 'none' | 'adminOnly' | 'approvedLicense' | 'discordMember' | 'discordRoles' {
  return ['adminOnly', 'approvedLicense', 'discordMember', 'discordRoles'].includes(String(value))
    ? value as 'adminOnly' | 'approvedLicense' | 'discordMember' | 'discordRoles' : 'none';
}
