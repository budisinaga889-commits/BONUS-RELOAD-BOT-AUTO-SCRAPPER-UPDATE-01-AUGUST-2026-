import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script - exposes safe IPC API to renderer
 */
contextBridge.exposeInMainWorld('electron', {
  // Monitoring
  startMonitoring: (panelUrl: string) => ipcRenderer.invoke('monitoring:start', panelUrl),
  stopMonitoring: () => ipcRenderer.invoke('monitoring:stop'),
  validatePreRun: () => ipcRenderer.invoke('monitoring:validate-prerun'),
  getStats: () => ipcRenderer.invoke('monitoring:get-stats'),
  
  // Browser
  launchBrowser: (panelUrl?: string) => ipcRenderer.invoke('browser:launch', panelUrl),
  closeBrowser: () => ipcRenderer.invoke('browser:close'),
  checkLogin: () => ipcRenderer.invoke('browser:check-login'),
  
  // Google Sheets
  browseCredential: () => ipcRenderer.invoke('google:browse-credential'),
  saveGoogleConfig: (credPath: string, spreadsheetId: string) => 
    ipcRenderer.invoke('google:save-config', credPath, spreadsheetId),
  testGoogleConnection: (credPath: string, spreadsheetId: string) => 
    ipcRenderer.invoke('google:test-connection', credPath, spreadsheetId),
  loadGoogleConfig: () => ipcRenderer.invoke('google:load-config'),
  
  // Filter Profiles
  getFilters: () => ipcRenderer.invoke('filters:get-all'),
  createFilter: (profile: any) => ipcRenderer.invoke('filters:create', profile),
  updateFilter: (id: string, updates: any) => ipcRenderer.invoke('filters:update', id, updates),
  deleteFilter: (id: string) => ipcRenderer.invoke('filters:delete', id),
  
  // Configuration
  getAppConfig: () => ipcRenderer.invoke('config:get-app'),
  saveAppConfig: (config: any) => ipcRenderer.invoke('config:save-app', config),
  
  // Events
  onStateChange: (callback: (state: string) => void) => {
    ipcRenderer.on('monitoring:state-changed', (_, state) => callback(state));
  },
  onStatsUpdate: (callback: (stats: any) => void) => {
    ipcRenderer.on('monitoring:stats-updated', (_, stats) => callback(stats));
  },
  
  // Logs
  onLogEntry: (callback: (entry: any) => void) => {
    const listener = (_: any, entry: any) => callback(entry);
    ipcRenderer.on('log:entry', listener);
    // Return an unsubscribe so React effects can clean up on unmount.
    return () => ipcRenderer.removeListener('log:entry', listener);
  },
  getRecentLogs: (limit?: number) => ipcRenderer.invoke('logs:get-recent', limit),

  // -------- Iteration 12 --------
  // Maintenance
  maintDbHealth:         () => ipcRenderer.invoke('maintenance:db-health'),
  maintVacuum:           () => ipcRenderer.invoke('maintenance:vacuum'),
  maintAnalyze:          () => ipcRenderer.invoke('maintenance:analyze'),
  maintReindex:          () => ipcRenderer.invoke('maintenance:reindex'),
  maintCleanupPreview:   (days: number) => ipcRenderer.invoke('maintenance:cleanup-preview', days),
  maintCleanupExecute:   (days: number) => ipcRenderer.invoke('maintenance:cleanup-execute', days),
  maintResumeGet:        () => ipcRenderer.invoke('maintenance:resume-get'),
  maintResumeSet:        (v: string) => ipcRenderer.invoke('maintenance:resume-set', v),
  maintResumeReset:      () => ipcRenderer.invoke('maintenance:resume-reset'),
  maintBackupList:       () => ipcRenderer.invoke('maintenance:backup-list'),
  maintBackupCreate:     (mode: 'db-only' | 'full') => ipcRenderer.invoke('maintenance:backup-create', mode),
  maintBackupRestore:    (path: string) => ipcRenderer.invoke('maintenance:backup-restore', path),
  maintLogsOpen:         () => ipcRenderer.invoke('maintenance:logs-open'),
  maintLogsClear:        () => ipcRenderer.invoke('maintenance:logs-clear'),
  maintLogsExport:       () => ipcRenderer.invoke('maintenance:logs-export'),
  maintDiagReport:       () => ipcRenderer.invoke('maintenance:diagnostic-report'),
  maintDiagSave:         (format: 'txt' | 'json') => ipcRenderer.invoke('maintenance:diagnostic-save', { format }),
  maintRetryQueue:       () => ipcRenderer.invoke('maintenance:retry-queue'),
  // Reset
  resetWindowLayout:     () => ipcRenderer.invoke('reset:window-layout'),
  resetUiPreferences:    () => ipcRenderer.invoke('reset:ui-preferences'),
  resetCachedMetadata:   () => ipcRenderer.invoke('reset:cached-metadata'),
  resetPanelSession:     () => ipcRenderer.invoke('reset:panel-session'),
  resetLocalConfig:      () => ipcRenderer.invoke('reset:local-config'),
  resetFull:             (opts: { keepFilterProfiles: boolean; keepGoogleConfig: boolean }) => ipcRenderer.invoke('reset:full', opts),
  // Filter Options
  filterOptionsCache:    () => ipcRenderer.invoke('filter-options:read-cache'),
  filterOptionsRefresh:  () => ipcRenderer.invoke('filter-options:refresh'),
  // Config Management
  exportConfiguration:   () => ipcRenderer.invoke('config:export'),
  importConfiguration:   () => ipcRenderer.invoke('config:import'),
  // App restart helper
  restartApp:            () => ipcRenderer.invoke('app:restart')
});
