import { ipcMain, dialog } from 'electron';
import { MonitoringEngine } from './services/monitoring-engine';
import { PlaywrightService } from './services/playwright-service';
import { GoogleSheetsService } from './services/google-sheets-service';
import { FilterManager } from './services/filter-manager';
import { ConfigManager } from './services/config-manager';
import { SQLiteService } from './services/sqlite-service';
import { AppDirectoryManager } from './services/app-directory-manager';
import { MaintenanceService } from './services/maintenance-service';
import { ResetService } from './services/reset-service';
import { WindowManager } from './window-manager';
import { getLogger } from './services/logger-service';

interface Services {
  monitoringEngine: MonitoringEngine;
  playwrightService: PlaywrightService;
  googleSheetsService: GoogleSheetsService;
  filterManager: FilterManager;
  configManager: ConfigManager;
  sqliteService: SQLiteService;
  appDirManager: AppDirectoryManager;
  maintenanceService: MaintenanceService;
  resetService: ResetService;
  windowManager: WindowManager;
}

export function registerIPCHandlers(services: Services) {
  const logger = getLogger();
  
  // Set up monitoring callbacks to broadcast to renderer
  services.monitoringEngine.setStateChangeCallback((state) => {
    services.windowManager.sendToRenderer('monitoring:state-changed', state);
  });
  
  services.monitoringEngine.setStatsUpdateCallback((stats) => {
    services.windowManager.sendToRenderer('monitoring:stats-updated', stats);
  });
  
  // Monitoring
  ipcMain.handle('monitoring:start', async (_, panelUrl: string) => {
    try {
      await services.monitoringEngine.startMonitoring(panelUrl);
      return { success: true };
    } catch (error: any) {
      logger.error('Failed to start monitoring', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('monitoring:stop', async () => {
    try {
      await services.monitoringEngine.stopMonitoring();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('monitoring:validate-prerun', async () => {
    try {
      const validation = await services.monitoringEngine.validatePreRunChecks();
      return { success: true, data: validation };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('monitoring:get-stats', async () => {
    try {
      return { success: true, data: services.monitoringEngine.getExportStats() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  // Browser
  ipcMain.handle('browser:launch', async (_, panelUrl?: string) => {
    try {
      await services.playwrightService.launch(panelUrl);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('browser:close', async () => {
    try {
      await services.playwrightService.close();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('browser:check-login', async () => {
    try {
      const result = await services.playwrightService.validateSession();
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  // Google Sheets
  ipcMain.handle('google:browse-credential', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Google Service Account JSON',
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        properties: ['openFile']
      });
      
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }
      
      return { success: true, data: result.filePaths[0] };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('google:save-config', async (_, sourceCredPath: string, spreadsheetId: string) => {
    try {
      const credPath = await services.googleSheetsService.saveCredentialFile(sourceCredPath);
      
      const config = {
        credentialJsonPath: credPath,
        spreadsheetId,
        worksheetName: 'MASTER' as const,
        serviceAccountEmail: '',
        spreadsheetTitle: null,
        isConnected: false,
        headersValidated: false,
        headersInitialized: false,
        lastConnectionTest: null,
        lastError: null
      };
      
      await services.configManager.saveGoogleSheetsConfig(config);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('google:test-connection', async (_, credPath: string, spreadsheetId: string) => {
    try {
      const result = await services.googleSheetsService.testConnection(credPath, spreadsheetId);
      
      if (result.success) {
        const config = await services.configManager.loadGoogleSheetsConfig();
        if (config) {
          config.isConnected = true;
          config.headersValidated = true;
          config.spreadsheetTitle = result.spreadsheetTitle || null;
          config.serviceAccountEmail = result.serviceAccountEmail || '';
          config.lastConnectionTest = new Date();
          config.lastError = null;
          await services.configManager.saveGoogleSheetsConfig(config);
        }
      }
      
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('google:load-config', async () => {
    try {
      const config = await services.configManager.loadGoogleSheetsConfig();
      return { success: true, data: config };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  // Filters
  ipcMain.handle('filters:get-all', async () => {
    try {
      return { success: true, data: services.filterManager.getAllProfiles() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('filters:create', async (_, profile) => {
    try {
      const created = await services.filterManager.createProfile(profile);
      return { success: true, data: created };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('filters:update', async (_, id: string, updates) => {
    try {
      await services.filterManager.updateProfile(id, updates);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('filters:delete', async (_, id: string) => {
    try {
      await services.filterManager.deleteProfile(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  // Config
  ipcMain.handle('config:get-app', async () => {
    try {
      return { success: true, data: await services.configManager.loadAppConfig() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('config:save-app', async (_, config) => {
    try {
      await services.configManager.saveAppConfig(config);
      // Propagate the diagnostic-logging toggle to the running logger so the
      // operator sees the effect immediately, without an app restart.
      try {
        const enabled = config?.features?.diagnosticLogging === true;
        getLogger().setDiagEnabled(enabled);
        getLogger().info(`Diagnostic Logging: ${enabled ? 'ENABLED' : 'disabled'} (via Settings save)`);
      } catch { /* logger not ready — will pick up on next boot */ }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  // Logs
  ipcMain.handle('logs:get-recent', async (_, limit?: number) => {
    try {
      return { success: true, data: getLogger().getRecent(limit) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ==========================================================
  // Iteration 12 — Maintenance, Reset, Filter Options, Backup
  // ==========================================================
  const maint = services.maintenanceService;
  const reset = services.resetService;
  const wrap = (fn: () => Promise<any>) => async () => {
    try { return { success: true, data: await fn() }; }
    catch (error: any) { return { success: false, error: error.message }; }
  };
  const wrap1 = <T>(fn: (arg: T) => Promise<any>) => async (_: any, arg: T) => {
    try { return { success: true, data: await fn(arg) }; }
    catch (error: any) { return { success: false, error: error.message }; }
  };

  // --- Maintenance ------------------------------------------
  ipcMain.handle('maintenance:db-health',        wrap(() => maint.getDbHealth()));
  ipcMain.handle('maintenance:vacuum',           wrap(() => maint.vacuum()));
  ipcMain.handle('maintenance:analyze',          wrap(() => maint.analyze()));
  ipcMain.handle('maintenance:reindex',          wrap(() => maint.reindex()));
  ipcMain.handle('maintenance:cleanup-preview',  wrap1<number>(async (days) => maint.cleanupPreview(days)));
  ipcMain.handle('maintenance:cleanup-execute',  wrap1<number>(async (days) => maint.cleanupExecute(days)));
  ipcMain.handle('maintenance:resume-get',       wrap(() => maint.getResumeMarker()));
  ipcMain.handle('maintenance:resume-set',       wrap1<string>(async (v) => maint.setResumeMarker(v)));
  ipcMain.handle('maintenance:resume-reset',     wrap(() => maint.resetResumeMarker()));
  ipcMain.handle('maintenance:backup-list',      wrap(async () => maint.listBackups()));
  ipcMain.handle('maintenance:backup-create',    wrap1<'db-only' | 'full'>(async (mode) => maint.createBackup(mode)));
  ipcMain.handle('maintenance:backup-restore',   wrap1<string>(async (p) => maint.restoreBackup(p)));
  ipcMain.handle('maintenance:logs-open',        wrap(() => maint.openLogsFolder()));
  ipcMain.handle('maintenance:logs-clear',       wrap(() => maint.clearLogs()));
  ipcMain.handle('maintenance:logs-export',      wrap(async () => {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (res.canceled || !res.filePaths[0]) throw new Error('Export canceled');
    return maint.exportLogs(res.filePaths[0]);
  }));
  ipcMain.handle('maintenance:diagnostic-report', wrap(() => maint.diagnosticReport()));
  ipcMain.handle('maintenance:diagnostic-save',  wrap1<{ format: 'txt' | 'json' }>(async ({ format }) => {
    const res = await dialog.showSaveDialog({
      defaultPath: `diagnostic-${new Date().toISOString().slice(0,10)}.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }]
    });
    if (res.canceled || !res.filePath) throw new Error('Save canceled');
    await maint.saveDiagnosticReport(res.filePath, format);
    return { path: res.filePath };
  }));
  ipcMain.handle('maintenance:retry-queue',      wrap(async () => maint.retryQueueStatus()));

  // --- Reset ------------------------------------------------
  ipcMain.handle('reset:window-layout',   wrap(() => reset.resetWindowLayout()));
  ipcMain.handle('reset:ui-preferences',  wrap(() => reset.resetUiPreferences()));
  ipcMain.handle('reset:cached-metadata', wrap(() => reset.resetCachedMetadata()));
  ipcMain.handle('reset:panel-session',   wrap(() => reset.resetPanelSession()));
  ipcMain.handle('reset:local-config',    wrap(() => reset.resetLocalConfig()));
  ipcMain.handle('reset:full',            wrap1<{ keepFilterProfiles: boolean; keepGoogleConfig: boolean }>(async (opts) => reset.resetFull(opts)));

  // --- Filter Options (Bank / Payment dropdowns) ------------
  const cachePath = services.appDirManager.getFilterOptionsCachePath();
  const fs2 = require('fs');
  ipcMain.handle('filter-options:read-cache', wrap(async () => {
    try { return JSON.parse(fs2.readFileSync(cachePath, 'utf8')); }
    catch { return { payment: [], bank: [], agent: [], lastRefreshed: null }; }
  }));
  ipcMain.handle('filter-options:refresh', wrap(async () => {
    const opts = await services.playwrightService.readFilterOptions();
    const payload = { ...opts, lastRefreshed: new Date().toISOString() };
    fs2.writeFileSync(cachePath, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
  }));

  // --- Configuration Management ----------------------------
  ipcMain.handle('config:export', wrap(async () => {
    const res = await dialog.showSaveDialog({
      defaultPath: `configuration-${new Date().toISOString().slice(0,10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (res.canceled || !res.filePath) throw new Error('Export canceled');
    const payload = {
      exportedAt: new Date().toISOString(),
      appConfig: await services.configManager.loadAppConfig(),
      filterProfiles: await services.configManager.loadFilterProfiles(),
      googleSheets: await services.configManager.loadGoogleSheetsConfig(),
    };
    fs2.writeFileSync(res.filePath, JSON.stringify(payload, null, 2), 'utf8');
    return { path: res.filePath };
  }));
  ipcMain.handle('config:import', wrap(async () => {
    const res = await dialog.showOpenDialog({
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (res.canceled || !res.filePaths[0]) throw new Error('Import canceled');
    const payload = JSON.parse(fs2.readFileSync(res.filePaths[0], 'utf8'));
    if (payload.appConfig)     await services.configManager.saveAppConfig(payload.appConfig);
    if (payload.filterProfiles) await services.configManager.saveFilterProfiles(payload.filterProfiles);
    if (payload.googleSheets)  await services.configManager.saveGoogleSheetsConfig(payload.googleSheets);
    return { imported: true };
  }));

  logger.info('IPC handlers registered');

  // App-level ops
  ipcMain.handle('app:restart', async () => {
    try {
      const { app: electronApp } = require('electron');
      electronApp.relaunch();
      electronApp.exit(0);
      return { success: true };
    } catch (error: any) { return { success: false, error: error.message }; }
  });
}
