import { createHash } from 'node:crypto';

export interface ConsoleSecurityPolicy {
  mode: 'restricted' | 'development';
  blockVanillaCheats: boolean;
  blockUnauthorizedServerCommands: true;
  monitorMovement: boolean;
  movementEnforcement: 'off' | 'monitor';
  logViolations: boolean;
  logAllowedAdminCommands: boolean;
}
export const consoleSecurityDefaults: ConsoleSecurityPolicy = {
  mode: 'restricted', blockVanillaCheats: true, blockUnauthorizedServerCommands: true,
  monitorMovement: true, movementEnforcement: 'monitor', logViolations: true, logAllowedAdminCommands: true,
};
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
export function inspectConsoleSecurity(settings: Record<string, any>) {
  const policy = { ...consoleSecurityDefaults }, diagnostics: string[] = [];
  if (settings.enableConsoleCommandsForAll !== undefined && settings.enableConsoleCommandsForAll !== false) diagnostics.push('LEGACY_CONSOLE_BYPASS_IGNORED');
  const value = settings.consoleSecurity;
  if (value === undefined) return { policy, diagnostics };
  if (!object(value)) return { policy, diagnostics: [...diagnostics, 'INVALID_CONSOLE_SECURITY'] };
  if (Object.keys(value).some(key => !Object.prototype.hasOwnProperty.call(policy, key))) diagnostics.push('UNKNOWN_CONSOLE_SECURITY_FIELD');
  if (value.mode !== undefined) {
    if (value.mode === 'restricted' || value.mode === 'development') policy.mode = value.mode;
    else diagnostics.push('INVALID_CONSOLE_MODE');
  }
  for (const key of ['blockVanillaCheats', 'monitorMovement', 'logViolations', 'logAllowedAdminCommands'] as const) {
    if (value[key] !== undefined) {
      if (typeof value[key] === 'boolean') policy[key] = value[key];
      else diagnostics.push('INVALID_' + key);
    }
  }
  if (value.blockUnauthorizedServerCommands !== undefined && value.blockUnauthorizedServerCommands !== true) diagnostics.push('SERVER_AUTHORIZATION_REQUIRED');
  if (policy.mode === 'restricted' && !policy.blockVanillaCheats) {
    policy.blockVanillaCheats = true; diagnostics.push('RESTRICTED_REQUIRES_VANILLA_PROTECTION');
  }
  if (value.movementEnforcement !== undefined) {
    // "enforce" was never stricter than "monitor"; saved settings keep loading.
    if (value.movementEnforcement === 'enforce') policy.movementEnforcement = 'monitor';
    else if (['off', 'monitor'].includes(value.movementEnforcement)) policy.movementEnforcement = value.movementEnforcement;
    else diagnostics.push('INVALID_MOVEMENT_ENFORCEMENT');
  }
  return { policy, diagnostics };
}
export function validateConsoleSecuritySettings(settings: unknown): string | null {
  if (!object(settings)) return 'INVALID_SETTINGS_OBJECT';
  const inspection = inspectConsoleSecurity(settings);
  return inspection.diagnostics.find(code => code !== 'LEGACY_CONSOLE_BYPASS_IGNORED') ?? null;
}
export const consoleSecurityRevision = (settings: Record<string, any>) => createHash('sha256').update(JSON.stringify({
  consoleSecurity: settings.consoleSecurity ?? null, enableConsoleCommandsForAll: settings.enableConsoleCommandsForAll ?? null,
})).digest('hex');

export interface PermissionContext { userId: number; actorId: number; profileId: number; targetId: number; permission: string; source: 'native_console' | 'plugin' }
type PermissionResolver = (context: Readonly<PermissionContext>) => boolean | null | undefined;
export interface ConsoleSecurityApi {
  readonly apiVersion: 1;
  hasPermission(userId: number, permission: string): boolean;
  setPermissionResolver(owner: string, resolver: PermissionResolver | null): void;
  grantMovementAllowance(actorId: number, milliseconds: number): void;
  getStatus(): ReturnType<ConsoleSecurityService['status']>;
}
const permissionName = /^[a-z][a-z0-9_.:-]{0,127}$/;
export const coreConsoleCommands = ['additem', 'equipitem', 'placeatme', 'disable'] as const;
export const clientConsoleCommands = ['tcl', 'tgm', 'tim', 'modav', 'setav', 'forceav', 'setlevel', 'coc', 'moveto', 'kill', 'resurrect', 'enable', 'unlock', ...coreConsoleCommands];

export class ConsoleSecurityService {
  private reports = new Map<number, { at: number; supported: string[]; unsupported: string[] }>();
  private requestAt = new Map<string, number>();
  private logs = new Map<string, { at: number; repeated: number }>();
  private resolver: { owner: string; resolve: PermissionResolver } | null = null;
  private resolving = false;
  readonly api: ConsoleSecurityApi;
  constructor(private server: any, private bootSettings: Record<string, any>, private log: (message: string) => void = console.info) {
    this.api = Object.freeze({ apiVersion: 1 as const,
      hasPermission: (userId: number, permission: string) => this.hasPermission(userId, permission),
      setPermissionResolver: (owner: string, resolver: PermissionResolver | null) => this.setResolver(owner, resolver),
      grantMovementAllowance: (actorId: number, milliseconds: number) => {
        if (!Number.isSafeInteger(actorId) || actorId <= 0 || !Number.isSafeInteger(milliseconds) || milliseconds < 0 || milliseconds > 30000 || typeof this.server.grantMovementAllowance !== 'function') throw Error('Invalid or unsupported movement allowance');
        this.server.grantMovementAllowance(actorId, milliseconds);
      },
      getStatus: () => this.status(),
    });
    if (typeof server.setConsoleCommandAuthorizer === 'function') server.setConsoleCommandAuthorizer((context: PermissionContext) => this.resolve(context));
    else this.log('[security] NATIVE_CONSOLE_SECURITY_UPDATE_REQUIRED; no native protection is being claimed');
    server.on('customPacket', (userId: number, raw: string) => this.packet(userId, raw));
    server.on('disconnect', (userId: number) => { this.reports.delete(userId); for (const key of this.requestAt.keys()) if (key.startsWith(userId + ':')) this.requestAt.delete(key); });
  }
  private actor(userId: number) {
    if (!Number.isSafeInteger(userId) || userId < 0 || userId >= 65535 || !this.server.isConnected(userId)) return null;
    try {
      const actorId = this.server.getUserActor(userId);
      if (!Number.isSafeInteger(actorId) || actorId <= 0 || this.server.getUserByActor(actorId) !== userId) return null;
      return { userId, actorId, profileId: this.server.get(actorId, 'profileId') };
    } catch { return null; }
  }
  private resolve(context: PermissionContext): boolean | null {
    if (!this.resolver) return null;
    if (this.resolving) return false;
    this.resolving = true;
    try {
      const result: any = this.resolver.resolve(Object.freeze({ ...context }));
      if (result && typeof result.then === 'function') { Promise.resolve(result).catch(() => {}); return false; }
      return result == null ? null : result === true;
    } catch { return false; } finally { this.resolving = false; }
  }
  resetPermissions() { this.resolver = null; }
  private setResolver(owner: string, resolver: PermissionResolver | null) {
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(owner) || resolver !== null && typeof resolver !== 'function') throw Error('Invalid permission resolver');
    if (this.resolver && this.resolver.owner !== owner) throw Error('Permission resolver already owned');
    this.resolver = resolver ? { owner, resolve: resolver } : null;
  }
  private hasPermission(userId: number, permission: string) {
    if (typeof permission !== 'string' || !permissionName.test(permission)) return false;
    const actor = this.actor(userId); if (!actor) return false;
    const result = this.resolve({ ...actor, targetId: actor.actorId, permission, source: 'plugin' });
    if (result !== null) return result;
    try { return coreConsoleCommands.some(command => permission === 'console.' + command) && this.server.get(actor.actorId, 'consoleCommandsAllowed') === true; } catch { return false; }
  }
  private native(userId?: number) {
    try {
      const value = this.server.getConsoleSecurityState?.(userId);
      return value?.apiVersion === 1 && value.serverAuthorization === 'enforced' ? value : null;
    } catch { return null; }
  }
  status() {
    const active = this.native();
    return { active, reports: [...this.reports].slice(0, 1000).map(([userId, value]) => ({ userId, ...value, trust: 'client_report_unverified' })), clientProtectionVerified: false,
      nativeSupported: active !== null, diagnostics: active?.diagnostics ?? [...inspectConsoleSecurity(this.bootSettings).diagnostics, 'NATIVE_CONSOLE_SECURITY_UPDATE_REQUIRED'] };
  }
  private audit(userId: number, command: string, reason: string) {
    const active = this.native();
    if (!(active?.policy ?? inspectConsoleSecurity(this.bootSettings).policy).logViolations) return;
    const key = userId + ':' + command, now = Date.now(), before = this.logs.get(key);
    if (before && now - before.at < 5000) { before.repeated++; return; }
    if (this.logs.size >= 1024) this.logs.delete(this.logs.keys().next().value!);
    this.logs.set(key, { at: now, repeated: 0 });
    this.log('[security] ' + JSON.stringify({ event: 'client_console_block_report', userId, command, reason, source: 'client_report', blocked: false, reportedBlocked: true, repeated: before?.repeated ?? 0, timestamp: new Date(now).toISOString() }));
  }
  private packet(userId: number, raw: string) {
    if (typeof raw !== 'string' || raw.length > 8192) return;
    let value: any; try { value = JSON.parse(raw); } catch { return; }
    if (!object(value) || !['consoleSecurity:hello', 'consoleSecurity:blocked', 'consoleSecurity:report'].includes(value.customPacketType) || value.apiVersion !== 1) return;
    if (!this.actor(userId)) return;
    const rateKey = userId + ':' + value.customPacketType;
    const now = Date.now(), previous = this.requestAt.get(rateKey) ?? 0;
    if (now - previous < 250) return;
    this.requestAt.set(rateKey, now);
    if (value.customPacketType === 'consoleSecurity:hello') {
      if (typeof value.requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(value.requestId)) return;
      const native = this.native(userId);
      if (!native?.authenticated) return;
      this.server.sendCustomPacket(userId, JSON.stringify({ customPacketType: 'consoleSecurity:policy', apiVersion: 1, requestId: value.requestId, policy: native.policy, allowedServerCommands: native.allowedServerCommands }));
    } else if (value.customPacketType === 'consoleSecurity:blocked') {
      if (typeof value.command === 'string' && clientConsoleCommands.includes(value.command)) this.audit(userId, value.command, 'reported_by_client');
    } else {
      const list = (input: any) => Array.isArray(input) && input.length <= 32 && input.every((name: any) => typeof name === 'string' && clientConsoleCommands.includes(name));
      if (!list(value.supported) || !list(value.unsupported)) return;
      this.reports.set(userId, { at: now, supported: [...new Set<string>(value.supported)], unsupported: [...new Set<string>(value.unsupported)] });
    }
  }
}

export function registerConsoleSecurity(router: any, dependencies: {
  read: () => Record<string, any>; write: (settings: Record<string, any>) => void;
  authorize: (ctx: any, write: boolean) => boolean; status: () => any; log: (message: string) => void;
}) {
  const view = () => {
    const settings = dependencies.read(), saved = inspectConsoleSecurity(settings), runtime = dependencies.status();
    const active = runtime?.active ?? null;
    return { ok: true, saved: saved.policy, active: active?.policy ?? null, revision: consoleSecurityRevision(settings), diagnostics: [...new Set([...saved.diagnostics, ...(runtime?.diagnostics ?? [])])],
      restartRequired: active === null ? null : Object.keys(consoleSecurityDefaults).some(key => saved.policy[key as keyof ConsoleSecurityPolicy] !== active.policy?.[key]),
      nativeSupported: runtime?.nativeSupported === true, reports: runtime?.reports ?? [], clientProtectionVerified: false, heuristicEnforcement: false };
  };
  router.get('/api/admin/console-security', (ctx: any) => {
    if (!dependencies.authorize(ctx, false)) return; ctx.set('Cache-Control', 'no-store');
    try { ctx.body = view(); } catch { ctx.status = 503; ctx.body = { ok: false, code: 'CONSOLE_SECURITY_UNAVAILABLE' }; }
  });
  router.put('/api/admin/console-security', (ctx: any) => {
    if (!dependencies.authorize(ctx, true)) return; ctx.set('Cache-Control', 'no-store');
    let sameOrigin = false;
    try { const origin = new URL(ctx.get('origin')); sameOrigin = ['http:', 'https:'].includes(origin.protocol) && origin.host === ctx.host; } catch {}
    if (!sameOrigin || ctx.get('content-type').split(';')[0].trim() !== 'application/json' || !['', 'same-origin', 'none'].includes(ctx.get('sec-fetch-site'))) { ctx.status = 403; ctx.body = { ok: false, code: 'CONSOLE_SECURITY_ORIGIN_REQUIRED' }; return; }
    const body = ctx.request.body;
    if (!object(body) || Object.keys(body).some(key => !['revision', 'consoleSecurity'].includes(key)) || typeof body.revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.revision) || !object(body.consoleSecurity)) { ctx.status = 400; ctx.body = { ok: false, code: 'INVALID_CONSOLE_SECURITY' }; return; }
    const error = validateConsoleSecuritySettings({ consoleSecurity: body.consoleSecurity });
    if (error) { ctx.status = 400; ctx.body = { ok: false, code: error }; return; }
    try {
      const latest = dependencies.read();
      if (consoleSecurityRevision(latest) !== body.revision) { ctx.status = 409; ctx.body = { ok: false, code: 'STALE_CONSOLE_SECURITY' }; return; }
      latest.consoleSecurity = inspectConsoleSecurity({ consoleSecurity: body.consoleSecurity }).policy;
      dependencies.write(latest);
      dependencies.log('Console Security policy saved; activation requires a game-server restart');
      ctx.body = { ...view(), activation: 'next_game_start' };
    } catch { ctx.status = 503; ctx.body = { ok: false, code: 'CONSOLE_SECURITY_SAVE_FAILED' }; }
  });
}
