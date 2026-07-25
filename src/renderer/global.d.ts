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
    };
  }
}

export {};
