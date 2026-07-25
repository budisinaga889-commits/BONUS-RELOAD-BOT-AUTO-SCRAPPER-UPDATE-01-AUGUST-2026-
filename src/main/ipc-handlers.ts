import { ipcMain, dialog } from 'electron';
import { MonitoringEngine } from './services/monitoring-engine';
import { PlaywrightService } from './services/playwright-service';
import { GoogleSheetsService } from './services/google-sheets-service';
import { FilterManager } from './services/filter-manager';
import { ConfigManager } from './services/config-manager';
import { SQLiteService } from './services/sqlite-service';
import { AppDirectoryManager } from './services/app-directory-manager';
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
  
  logger.info('IPC handlers registered');
}
