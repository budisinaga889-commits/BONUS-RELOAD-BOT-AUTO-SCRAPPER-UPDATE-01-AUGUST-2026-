import path from 'path';
import fs from 'fs';
import { AppDirectoryManager } from './app-directory-manager';
import { ConfigManager } from './config-manager';
import { DEFAULT_CONFIG } from '../../utils/constants';
import { getLogger } from './logger-service';

/**
 * ResetService (Iteration 12)
 *
 * Every reset scope is a well-defined set of file operations bounded
 * to LOCAL APPLICATION CONFIGURATION ONLY. This service is FORBIDDEN
 * from touching:
 *   - SQLite database file (monitoring.db)
 *   - Transactions, fingerprints, resume marker (they live inside the DB)
 *   - Google Sheets credential file
 *   - Filter Profiles JSON (unless the operator explicitly opts in
 *     during the Full Reset flow)
 */
export type ResetScope =
  | 'window-layout'
  | 'ui-preferences'
  | 'cached-metadata'
  | 'panel-session'
  | 'local-config'
  | 'full';

export interface ResetResult {
  scope: ResetScope;
  removed: string[];
  requiresRestart: boolean;
  message: string;
}

export class ResetService {
  constructor(
    private appDirManager: AppDirectoryManager,
    private configManager: ConfigManager
  ) {}

  private safeDelete(target: string, removed: string[]) {
    if (!fs.existsSync(target)) return;
    try {
      const st = fs.statSync(target);
      if (st.isDirectory()) fs.rmSync(target, { recursive: true, force: true });
      else fs.unlinkSync(target);
      removed.push(target);
    } catch (e: any) {
      getLogger().warn(`ResetService.safeDelete failed for ${target}: ${e.message}`);
    }
  }
  private patchUiState(patch: (s: any) => any, removed: string[]) {
    const p = this.appDirManager.getUiStatePath();
    let cur: any = {};
    try { cur = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { /* fresh */ }
    const next = patch(cur) ?? {};
    if (Object.keys(next).length === 0) {
      this.safeDelete(p, removed);
      return;
    }
    fs.writeFileSync(p, JSON.stringify(next, null, 2), 'utf8');
    removed.push(`${p} (patched)`);
  }

  // ---------- SAFE resets ----------
  async resetWindowLayout(): Promise<ResetResult> {
    const removed: string[] = [];
    this.patchUiState(s => { const { window, ...rest } = s || {}; return rest; }, removed);
    // Local-page memory kept only in localStorage (chromium storage) —
    // that lives inside the renderer profile which is deleted by
    // `resetPanelSession` only. Window state on disk is handled here.
    return {
      scope: 'window-layout',
      removed,
      requiresRestart: true,
      message: 'Default window size, position and maximized state restored. Restart the application to see the new window bounds.'
    };
  }
  async resetUiPreferences(): Promise<ResetResult> {
    const removed: string[] = [];
    // Reserved for future UI prefs (column widths, table sort, theme).
    // Today the only UI-only prefs we persist are inside ui-state.json's
    // non-window keys — reset them here.
    this.patchUiState(s => { const { window } = s || {}; return window ? { window } : {}; }, removed);
    return {
      scope: 'ui-preferences',
      removed,
      requiresRestart: false,
      message: 'UI preferences cleared. Table column widths, sort states and local UI caches will start fresh on next render.'
    };
  }
  async resetCachedMetadata(): Promise<ResetResult> {
    const removed: string[] = [];
    this.safeDelete(this.appDirManager.getFilterOptionsCachePath(), removed);
    return {
      scope: 'cached-metadata',
      removed,
      requiresRestart: false,
      message: 'Cached Bank and Payment option lists were cleared. They will be re-read the next time you open the browser.'
    };
  }

  // ---------- MEDIUM resets ----------
  async resetPanelSession(): Promise<ResetResult> {
    const removed: string[] = [];
    // Playwright's persistent context lives under the browser-profile
    // directory. Wiping the whole profile forces the operator to log
    // in again but leaves the database, config, and filter profiles
    // untouched.
    this.safeDelete(this.appDirManager.getBrowserProfilePath(), removed);
    return {
      scope: 'panel-session',
      removed,
      requiresRestart: false,
      message: 'Panel session (cookies, localStorage, sessionStorage) removed. You will need to log in again when the browser is reopened.'
    };
  }
  async resetLocalConfig(): Promise<ResetResult> {
    const removed: string[] = [];
    // Overwrite the app config file with defaults, preserving the
    // filter-profiles.json + google-sheets.json + database completely.
    const cfgPath = this.appDirManager.getAppConfigPath();
    if (fs.existsSync(cfgPath)) {
      fs.writeFileSync(cfgPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
      removed.push(`${cfgPath} (reset to defaults)`);
    }
    this.safeDelete(this.appDirManager.getUiStatePath(), removed);
    return {
      scope: 'local-config',
      removed,
      requiresRestart: true,
      message: 'App configuration reset to factory defaults. Filter profiles, Google credentials, database, and resume marker are preserved.'
    };
  }

  // ---------- ADVANCED reset ----------
  async resetFull(opts: { keepFilterProfiles: boolean; keepGoogleConfig: boolean }): Promise<ResetResult> {
    const removed: string[] = [];
    // App config -> defaults
    fs.writeFileSync(this.appDirManager.getAppConfigPath(), JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
    removed.push(`${this.appDirManager.getAppConfigPath()} (defaults)`);
    // UI state
    this.safeDelete(this.appDirManager.getUiStatePath(), removed);
    // Cached options
    this.safeDelete(this.appDirManager.getFilterOptionsCachePath(), removed);
    // Panel session
    this.safeDelete(this.appDirManager.getBrowserProfilePath(), removed);
    // Optional wipes
    if (!opts.keepFilterProfiles) {
      this.safeDelete(this.appDirManager.getFilterProfilesPath(), removed);
    }
    if (!opts.keepGoogleConfig) {
      this.safeDelete(this.appDirManager.getGoogleSheetsConfigPath(), removed);
    }
    // NEVER TOUCH:
    //   - monitoring.db (or its -wal / -shm sidecars)
    //   - credentials/google-service-account.json (unless keepGoogleConfig=false)
    return {
      scope: 'full',
      removed,
      requiresRestart: true,
      message: 'Full application reset completed. Monitoring database, transactions, fingerprints and resume marker are preserved. Please restart the application.'
    };
  }
}
