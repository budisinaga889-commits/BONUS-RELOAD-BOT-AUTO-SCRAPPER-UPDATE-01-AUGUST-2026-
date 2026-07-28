import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
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
import { MaintenanceService } from './services/maintenance-service';
import { ResetService } from './services/reset-service';
import { registerIPCHandlers } from './ipc-handlers';

/**
 * Iteration 12 — Embedded Chromium discovery.
 * Startup order (never throw, never expose raw Playwright errors here):
 *   1. resources/browsers/chromium/  (bundled by electron-builder in
 *      production dist) — set PLAYWRIGHT_BROWSERS_PATH to this location.
 *   2. Fall back to Playwright's default `~/.cache/ms-playwright/`.
 *   3. If neither is present the operator sees a friendly error later
 *      when clicking Open Browser (handled by PlaywrightService.launchBrowser).
 */
function resolveEmbeddedChromium(): { embedded: boolean; path: string | null } {
  // Look next to the app resources first (works in production dist).
  const candidates: string[] = [];
  try { candidates.push(path.join(process.resourcesPath || '', 'browsers')); } catch {}
  try { candidates.push(path.join(app.getAppPath(), 'resources', 'browsers')); } catch {}
  try { candidates.push(path.join(app.getAppPath(), '..', 'resources', 'browsers')); } catch {}
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c) && fs.statSync(c).isDirectory()) {
        // Contains chromium- prefixed folders per Playwright convention.
        const hasChromium = fs.readdirSync(c).some(name => name.startsWith('chromium'));
        if (hasChromium) {
          process.env.PLAYWRIGHT_BROWSERS_PATH = c;
          return { embedded: true, path: c };
        }
      }
    } catch { /* keep searching */ }
  }
  return { embedded: false, path: process.env.PLAYWRIGHT_BROWSERS_PATH || null };
}

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

  // PATCH 12 — Desktop UI Polish (Patch 6). Remove the default Electron
  // application menu (File / Edit / View / Window / Help). The native
  // Windows title bar is kept as-is; we do NOT introduce a custom title
  // bar. Called BEFORE any BrowserWindow is created so no window ever
  // renders the default menu, not even briefly during startup.
  try { Menu.setApplicationMenu(null); } catch { /* non-fatal */ }

  logger.success('Application started');
  logger.info(`Mode: ${appDirManager.isPortableMode() ? 'PORTABLE' : 'INSTALLED'}`);
  logger.info(`Packaged: ${app.isPackaged}`);
  logger.info(`App path: ${app.getAppPath()}`);

  // Iteration 12 — set embedded Chromium path BEFORE PlaywrightService
  // instantiation so its launchBrowser call inherits the env var.
  const browserResolve = resolveEmbeddedChromium();
  logger.info(`Chromium source: ${browserResolve.embedded ? `EMBEDDED (${browserResolve.path})` : 'Playwright default (ms-playwright)'}`);

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
  windowManager.setAppDirManager(appDirManager);
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
    filterManager, configManager, sqliteService, appDirManager,
    maintenanceService: new MaintenanceService(
      appDirManager, sqliteService, configManager, googleSheetsService,
      playwrightService, monitoringEngine
    ),
    resetService: new ResetService(appDirManager, configManager),
    windowManager
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
