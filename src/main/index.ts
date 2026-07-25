import { app, BrowserWindow } from 'electron';
import { WindowManager } from './window-manager';
import { TrayManager } from './tray-manager';
import { AppDirectoryManager } from './services/app-directory-manager';
import { initializeLogger } from './services/logger-service';
import { ConfigManager } from './services/config-manager';
import { SQLiteService } from './services/sqlite-service';
import { PlaywrightService } from './services/playwright-service';
import { GoogleSheetsService } from './services/google-sheets-service';
import { FilterManager } from './services/filter-manager';
import { TransactionValidator } from './services/transaction-validator';
import { FingerprintGenerator } from './services/fingerprint-generator';
import { MonitoringEngine } from './services/monitoring-engine';
import { registerIPCHandlers } from './ipc-handlers';

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let windowManager: WindowManager;
let trayManager: TrayManager;

async function initializeApp() {
  const appDirManager = new AppDirectoryManager();
  const logger = initializeLogger(appDirManager.getLogsDir());
  
  logger.success('Application started');
  logger.info(`Mode: ${appDirManager.isPortableMode() ? 'PORTABLE' : 'INSTALLED'}`);
  logger.info(`Packaged: ${app.isPackaged}`);
  logger.info(`App path: ${app.getAppPath()}`);
  
  const configManager = new ConfigManager(appDirManager);
  const sqliteService = new SQLiteService(appDirManager);
  const playwrightService = new PlaywrightService(appDirManager);
  const googleSheetsService = new GoogleSheetsService(appDirManager);
  const filterManager = new FilterManager(configManager);
  const validator = new TransactionValidator();
  const fingerprintGen = new FingerprintGenerator();
  
  await sqliteService.initialize();
  
  // Propagate the operator's Diagnostic Logging preference from the persisted
  // config to the logger. Without this the logger.diag() calls emitted by
  // MonitoringEngine / PageScanner / HTMLMapper / PlaywrightService silently
  // no-op even after the operator ticks Settings → Diagnostic Logging.
  try {
    const bootCfg = await configManager.loadAppConfig();
    logger.setDiagEnabled(bootCfg?.features?.diagnosticLogging === true);
    logger.info(`Diagnostic Logging: ${logger.isDiagEnabled() ? 'ENABLED' : 'disabled'} (from persisted config)`);
  } catch (e: any) {
    logger.warn(`Could not apply diagnostic-logging preference on boot: ${e?.message || e}`);
  }
  
  const monitoringEngine = new MonitoringEngine(
    playwrightService, filterManager, validator, fingerprintGen,
    sqliteService, googleSheetsService, configManager
  );
  
  await monitoringEngine.initialize();
  
  windowManager = new WindowManager();
  windowManager.createMainWindow();
  
  // Stream every log entry (Winston + broadcast) to the renderer's Live Log panel.
  // Subscribing AFTER createMainWindow() means startup messages already went to the
  // ring buffer; the renderer will backfill them via `logs:get-recent` on mount.
  logger.subscribe((entry) => {
    windowManager.sendToRenderer('log:entry', entry);
  });
  
  trayManager = new TrayManager(windowManager);
  trayManager.createTray();
  
  registerIPCHandlers({
    monitoringEngine, playwrightService, googleSheetsService,
    filterManager, configManager, sqliteService, appDirManager, windowManager
  });
  
  logger.success('Application initialized');
}

app.whenReady().then(() => {
  initializeApp().catch(error => {
    console.error('Failed to initialize:', error);
    app.quit();
  });
});

// Second instance handler
app.on('second-instance', () => {
  if (windowManager) {
    windowManager.show();
  }
});

app.on('window-all-closed', () => {
  // Keep running in tray on all platforms (this is a background monitoring tool)
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && windowManager) {
    windowManager.createMainWindow();
  }
});

app.on('before-quit', () => {
  (global as any).isQuitting = true;
});
