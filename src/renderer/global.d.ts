/// <reference types="react" />

declare global {
  interface Window {
    electron: {
      startMonitoring: (panelUrl: string) => Promise<any>;
      stopMonitoring: () => Promise<any>;
      validatePreRun: () => Promise<any>;
      getStats: () => Promise<any>;
      launchBrowser: (panelUrl?: string) => Promise<any>;
      closeBrowser: () => Promise<any>;
      checkLogin: () => Promise<any>;
      browseCredential: () => Promise<any>;
      saveGoogleConfig: (credPath: string, spreadsheetId: string) => Promise<any>;
      testGoogleConnection: (credPath: string, spreadsheetId: string) => Promise<any>;
      loadGoogleConfig: () => Promise<any>;
      getFilters: () => Promise<any>;
      createFilter: (profile: any) => Promise<any>;
      updateFilter: (id: string, updates: any) => Promise<any>;
      deleteFilter: (id: string) => Promise<any>;
      getAppConfig: () => Promise<any>;
      saveAppConfig: (config: any) => Promise<any>;
      onStateChange: (callback: (state: string) => void) => void;
      onStatsUpdate: (callback: (stats: any) => void) => void;
      onLogEntry: (callback: (entry: any) => void) => () => void;
      getRecentLogs: (limit?: number) => Promise<any>;

      // Iteration 12 — Maintenance
      maintDbHealth: () => Promise<any>;
      maintVacuum: () => Promise<any>;
      maintAnalyze: () => Promise<any>;
      maintReindex: () => Promise<any>;
      maintCleanupPreview: (days: number) => Promise<any>;
      maintCleanupExecute: (days: number) => Promise<any>;
      maintResumeGet: () => Promise<any>;
      maintResumeSet: (v: string) => Promise<any>;
      maintResumeReset: () => Promise<any>;
      maintBackupList: () => Promise<any>;
      maintBackupCreate: (mode: 'db-only' | 'full') => Promise<any>;
      maintBackupRestore: (path: string) => Promise<any>;
      maintLogsOpen: () => Promise<any>;
      maintLogsClear: () => Promise<any>;
      maintLogsExport: () => Promise<any>;
      maintDiagReport: () => Promise<any>;
      maintDiagSave: (format: 'txt' | 'json') => Promise<any>;
      maintRetryQueue: () => Promise<any>;

      // Iteration 12 — Reset
      resetWindowLayout: () => Promise<any>;
      resetUiPreferences: () => Promise<any>;
      resetCachedMetadata: () => Promise<any>;
      resetPanelSession: () => Promise<any>;
      resetLocalConfig: () => Promise<any>;
      resetFull: (opts: { keepFilterProfiles: boolean; keepGoogleConfig: boolean }) => Promise<any>;

      // Iteration 12 — Filter Options
      filterOptionsCache: () => Promise<any>;
      filterOptionsRefresh: () => Promise<any>;

      // Iteration 12 — Configuration Management
      exportConfiguration: () => Promise<any>;
      importConfiguration: () => Promise<any>;

      // Iteration 12 — App control
      restartApp: () => Promise<any>;
    };
  }
}

export {};
