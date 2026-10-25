import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLoginMaster, getLoginProvider, LoginProvider, LoginSettings, normalizeJoinMode, selectLoginProvider } from './loginProviders';

type JoinAccess = {
  mode: ReturnType<typeof normalizeJoinMode>;
  rejectionMessage: string;
  approvedLicenses: string;
  approvedDiscordIds: string;
  discordRoleIds: string;
};
type AccessSettings = LoginSettings & { joinAccess: JoinAccess; playerAccess: NonNullable<LoginSettings['playerAccess']> };

export function AccessSettingsPanel({ settings, onChange }: {
  settings: AccessSettings;
  onChange: (changes: Partial<AccessSettings>) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const provider = getLoginProvider(settings.masterUrl, settings.offlineMode);
  const mode = settings.joinAccess.mode;
  const guest = settings.playerAccess.mode === 'guest';
  const accessPreset = guest ? (settings.playerAccess.approvalRequired ? 'guestApproval' : 'guestOpen') : (mode === 'none' ? 'accountOpen' : mode);
  const needsDiscord = mode === 'discordMember' || mode === 'discordRoles';
  const joinField = (key: Exclude<keyof JoinAccess, 'mode'>, label: string) => (
    <label className="admin-dashboard__cfg-field">
      <span>{t(`adminDashboard.${label}`)}</span>
      <input className="admin-dashboard__search-input" type="text" value={settings.joinAccess[key]}
        onChange={event => onChange({ joinAccess: { ...settings.joinAccess, [key]: event.target.value } })} />
    </label>
  );

  return <div className="admin-dashboard__access-layout">
    <section className="admin-dashboard__cfg-section admin-dashboard__cfg-section--wide" aria-labelledby={`${id}-connection-title`}>
      <header className="admin-dashboard__cfg-section-head"><span className="admin-dashboard__step-label">01</span>
        <div><h3 id={`${id}-connection-title`}>{t('adminDashboard.connectionAccessTitle')}</h3><p>{t('adminDashboard.steamMandatoryHint')}</p></div>
      </header>
      <div className="admin-dashboard__cfg-form-grid">
        <label className="admin-dashboard__cfg-field"><span>{t('adminDashboard.connectionAccessMode')}</span>
          <select className="admin-dashboard__log-select" value={accessPreset} onChange={event => {
            const value = event.target.value, isGuest = value === 'guestOpen' || value === 'guestApproval';
            onChange({ offlineMode: false, playerAccess: { ...settings.playerAccess, mode: isGuest ? 'guest' : 'account', approvalRequired: value === 'guestApproval' },
              joinAccess: { ...settings.joinAccess, mode: isGuest || value === 'accountOpen' ? 'none' : normalizeJoinMode(value) } });
          }}>
            {['guestOpen', 'guestApproval', 'accountOpen', 'discordMember', 'discordRoles', 'approvedLicense', 'adminOnly'].map(value =>
              <option key={value} value={value}>{t(`adminDashboard.connectionMode_${value}`)}</option>)}
          </select>
        </label>
        <label className="admin-dashboard__cfg-field"><span>{t('adminDashboard.steamApiKey')}</span>
          <input className="admin-dashboard__search-input" type="password" autoComplete="new-password" spellCheck={false}
            value={settings.playerAccess.steamApiKey} onChange={event => onChange({ playerAccess: { ...settings.playerAccess, steamApiKey: event.target.value } })} />
          <small><a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noreferrer">{t('adminDashboard.steamApiKeyLink')}</a></small>
        </label>
      </div>
      <p className="admin-dashboard__cfg-notice">{t(guest ? 'adminDashboard.steamGuestHint' : 'adminDashboard.steamAccountHint')}</p>
    </section>
    {!guest && <section className="admin-dashboard__cfg-section" aria-labelledby={`${id}-login-title`} data-testid="ingame-login-settings">
      <header className="admin-dashboard__cfg-section-head">
        <span className="admin-dashboard__step-label">02</span>
        <div><h3 id={`${id}-login-title`}>{t('adminDashboard.loginTitle')}</h3><p>{t('adminDashboard.loginIntro')}</p></div>
      </header>
      <label className="admin-dashboard__cfg-field">
        <span>{t('adminDashboard.loginProvider')}</span>
        <select className="admin-dashboard__log-select" value={provider}
          onChange={event => onChange(selectLoginProvider(settings, event.target.value as LoginProvider))}>
          {(['worlds', 'legacy', 'custom'] as LoginProvider[]).map(value =>
            <option value={value} key={value}>{t(`adminDashboard.loginProvider_${value}`)}</option>)}
        </select>
      </label>
      <p className={`admin-dashboard__cfg-notice${provider === 'legacy' ? ' admin-dashboard__cfg-notice--legacy' : ''}`}>
        {t(`adminDashboard.loginHint_${provider}`)}
      </p>
      {provider !== 'offline' && <div className="admin-dashboard__cfg-form-grid">
        <label className="admin-dashboard__cfg-field admin-dashboard__cfg-field--full">
          <span>{t('adminDashboard.loginMaster')}</span>
          <input className="admin-dashboard__search-input" type="url" value={settings.masterUrl}
            readOnly={provider !== 'custom'} spellCheck={false}
            onChange={event => onChange(changeLoginMaster(settings, event.target.value))} />
        </label>
        <label className="admin-dashboard__cfg-field">
          <span>{t('adminDashboard.loginServerId')}</span>
          <input className="admin-dashboard__search-input" value={settings.serverUid} autoComplete="off"
            onChange={event => onChange({ serverUid: event.target.value })} />
        </label>
        <label className="admin-dashboard__cfg-field">
          <span>{t('adminDashboard.loginServerKey')}</span>
          <input className="admin-dashboard__search-input" type="password" value={settings.masterKey} autoComplete="new-password"
            onChange={event => onChange({ masterKey: event.target.value })} />
        </label>
      </div>}
      <p className="admin-dashboard__cfg-hint">{t('adminDashboard.loginServiceChangeHint')}</p>
      <p className="admin-dashboard__cfg-hint">{t('adminDashboard.loginRestartHint')}</p>
    </section>}

    <section className="admin-dashboard__cfg-section" aria-labelledby={`${id}-access-title`}>
      <header className="admin-dashboard__cfg-section-head">
        <span className="admin-dashboard__step-label">{guest ? '02' : '03'}</span>
        <div><h3 id={`${id}-access-title`}>{t('adminDashboard.accessRulesTitle')}</h3><p>{t('adminDashboard.accessRulesIntro')}</p></div>
      </header>
      {guest ? <p className="admin-dashboard__cfg-notice">{t(settings.playerAccess.approvalRequired ? 'adminDashboard.guestApprovalHint' : 'adminDashboard.guestOpenHint')}</p> : <>
      <label className="admin-dashboard__cfg-field">
        <span>{t('adminDashboard.cfgJoinMode')}</span>
        <select className="admin-dashboard__log-select" value={mode}
          onChange={event => onChange({ joinAccess: { ...settings.joinAccess, mode: normalizeJoinMode(event.target.value) } })}>
          {(['none', 'adminOnly', 'approvedLicense', 'discordMember', 'discordRoles'] as JoinAccess['mode'][]).map(value =>
            <option key={value} value={value}>{t(`adminDashboard.cfgJoinMode_${value}`)}</option>)}
        </select>
      </label>
      <p className="admin-dashboard__cfg-notice">{t(mode === 'none' ? 'adminDashboard.accessOpenHint' : 'adminDashboard.accessRestrictedHint')}</p>
      {needsDiscord && <p className="admin-dashboard__cfg-notice" role="note">{t(settings.offlineMode ? 'adminDashboard.accessOfflineDiscordHint' : 'adminDashboard.accessDiscordHint')}</p>}
      <div className="admin-dashboard__cfg-form-grid">
        {mode !== 'none' && joinField('rejectionMessage', 'cfgJoinRejection')}
        {(mode === 'approvedLicense' || mode === 'adminOnly') && joinField('approvedLicenses', 'cfgApprovedLicenses')}
        {(needsDiscord || mode === 'adminOnly') && joinField('approvedDiscordIds', 'cfgApprovedDiscordIds')}
        {mode === 'discordRoles' && joinField('discordRoleIds', 'cfgDiscordRoles')}
      </div>
      </>}
    </section>

  </div>;
}
