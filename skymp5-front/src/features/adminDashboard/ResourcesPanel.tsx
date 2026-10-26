import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { handleTabNavigation } from '../../utils/tabNavigation';
import { ModLoadOrderPanel } from './ModLoadOrderPanel';
import { PluginsPanel } from './PluginsPanel';
import './resources.scss';

export const RESOURCE_TAB_STORAGE_KEY = 'skymp.adminResources.tab.v1';
type ResourceTab = 'mods' | 'plugins';

export function ResourcesPanel({ canView, canEditMods, canEditPlugins }: {
  canView: boolean; canEditMods: boolean; canEditPlugins: boolean;
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ResourceTab>(() => {
    try { return window.localStorage.getItem(RESOURCE_TAB_STORAGE_KEY) === 'plugins' ? 'plugins' : 'mods'; }
    catch { return 'mods'; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(RESOURCE_TAB_STORAGE_KEY, activeTab); }
    catch { /* The resource view also works without browser storage. */ }
  }, [activeTab]);

  return <div className="admin-resources" data-testid="admin-resources">
    <div className="admin-resources__tabs" role="tablist" aria-label={t('adminDashboard.resources.sections')} onKeyDown={handleTabNavigation}>
      {(['mods', 'plugins'] as const).map(tab => <button type="button" key={tab} role="tab"
        id={`resource-tab-${tab}`} data-testid={`resource-tab-${tab}`} aria-controls={`resource-panel-${tab}`}
        aria-selected={activeTab === tab} tabIndex={activeTab === tab ? 0 : -1} onClick={() => setActiveTab(tab)}>
        {t(tab === 'mods' ? 'adminDashboard.resources.mods' : 'adminDashboard.plugins.title')}
      </button>)}
    </div>
    <div id="resource-panel-mods" role="tabpanel" aria-labelledby="resource-tab-mods" hidden={activeTab !== 'mods'}>
      <ModLoadOrderPanel canView={canView} canEdit={canEditMods} />
    </div>
    <div id="resource-panel-plugins" role="tabpanel" aria-labelledby="resource-tab-plugins" hidden={activeTab !== 'plugins'}>
      <PluginsPanel canView={canView} canEdit={canEditPlugins} active={activeTab === 'plugins'} />
    </div>
  </div>;
}
