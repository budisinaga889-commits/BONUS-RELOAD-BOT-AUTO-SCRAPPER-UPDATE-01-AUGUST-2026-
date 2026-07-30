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
import { resolveChromium, applyChromiumResolution, BrowserResolution } from './services/browser-resolver';

/**
 * PATCH 13 — Runtime Chromium resolution is now delegated to the
 * dedicated `browser-resolver` service which applies the strict
 * priority chain:
 *
 *   1. Bundled          → resources/browsers/chromium-<rev>/
 *   2. Env override     → PLAYWRIGHT_BROWSERS_PATH
 *   3. Platform default → %LOCALAPPDATA%\ms-playwright  (Windows)
 *                         ~/Library/Caches/ms-playwright (macOS)
 *                         ~/.cache/ms-playwright         (Linux)
 *
 * On a failed resolution we DO NOT throw or expose Playwright's raw
 * exception. The friendly "Chromium Browser Not Found" dialog is
 * shown right after the main window becomes ready.
 */
let pendingBrowserFailure: BrowserResolution | null = null;

/**
 * Iteration 12 — Embedded Chromium discovery.
 * Startup order (never throw, never expose raw Playwright errors here):
 *   1. resources/browsers/chromium/  (bundled by electron-builder in
 *      production dist) — set PLAYWRIGHT_BROWSERS_PATH to this location.
 *   2. Fall back to Playwright's default `~/.cache/ms-playwright/`.
 *   3. If neither is present the operator sees a friendly error later
 *      when clicking Open Browser (handled by PlaywrightService.launchBrowser).
 */
/**
 * PATCH 13 — Legacy helper kept ONLY as a thin wrapper around the new
 * browser-resolver so any external caller (there are none inside the
 * repo) keeps working. Prefer `resolveChromium()` directly.
 */
function resolveEmbeddedChromium(): { embedded: boolean; path: string | null } {
  const r = resolveChromium();
  if (r.ok && r.browsersPath) {
    applyChromiumResolution(r);
    if (r.source !== 'bundled') pendingBrowserFailure = null;
    return { embedded: r.source === 'bundled', path: r.browsersPath };
  }
  pendingBrowserFailure = r;
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

  // PATCH 13 — Runtime browser resolution using the new resolver.
  // Emits a full search-trail into the app log so a failed launch on a
  // clean Windows PC can be diagnosed without exposing Playwright's
  // internal stack trace to the operator.
  const browserResolve = resolveEmbeddedChromium();
  if (browserResolve.embedded) {
    logger.info(`Chromium source: BUNDLED (${browserResolve.path})`);
  } else if (browserResolve.path) {
    logger.warn(`Chromium source: NOT BUNDLED — falling back to ${browserResolve.path}`);
  } else {
    logger.error('Chromium source: NOT FOUND in any known location. Operator will see the "Chromium Browser Not Found" dialog after the main window opens.');
    if (pendingBrowserFailure) {
      for (const s of pendingBrowserFailure.searched) {
        logger.warn(`  probed ${s.label}: ${s.path} (exists=${s.exists}, hasChromium=${s.hasChromium})`);
      }
    }
  }

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

  // PATCH 13 — If Chromium could not be resolved at startup, present
  // the friendly "Chromium Browser Not Found" dialog once the main
  // window is up. We deliberately delay the dialog until AFTER the
  // window exists so it appears modal on top of the dashboard and the
  // operator does not see a phantom modal in the tray.
  if (pendingBrowserFailure) {
    const failure = pendingBrowserFailure;
    setImmediate(async () => {
      try {
        const { showBrowserNotFoundDialog } = await import('./services/browser-resolver');
        await showBrowserNotFoundDialog(failure, appDirManager.getLogsDir());
      } catch (e: any) {
        logger.error('Failed to show Chromium Browser Not Found dialog', e);
      }
    });
  }
  
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
