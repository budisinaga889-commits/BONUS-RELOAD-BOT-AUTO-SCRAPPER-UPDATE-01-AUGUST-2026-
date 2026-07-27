import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export class AppDirectoryManager {
  private baseDir: string;
  private isPortable: boolean;
  
  constructor() {
    this.isPortable = process.env.PORTABLE_EXECUTABLE_DIR !== undefined;
    
    if (this.isPortable) {
      this.baseDir = path.join(
        process.env.PORTABLE_EXECUTABLE_DIR!,
        'LiveDepositMonitor-Data'
      );
    } else {
      this.baseDir = app.getPath('userData');
    }
    
    this.ensureDirectories();
  }
  
  private ensureDirectories(): void {
    const dirs = [
      this.getConfigDir(),
      this.getDatabaseDir(),
      this.getLogsDir(),
      this.getScreenshotsDir(),
      this.getBrowserProfileDir(),
      this.getCredentialsDir(),
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }
  
  getBaseDir(): string { return this.baseDir; }
  getConfigDir(): string { return path.join(this.baseDir, 'config'); }
  getDatabaseDir(): string { return path.join(this.baseDir, 'database'); }
  getDatabasePath(): string { return path.join(this.getDatabaseDir(), 'monitoring.db'); }
  getLogsDir(): string { return path.join(this.baseDir, 'logs'); }
  getScreenshotsDir(): string { return path.join(this.getLogsDir(), 'screenshots'); }
  getBrowserProfileDir(): string { return path.join(this.baseDir, 'browser-profile'); }
  getCredentialsDir(): string { return path.join(this.baseDir, 'credentials'); }
  getAppConfigPath(): string { return path.join(this.getConfigDir(), 'app.config.json'); }
  getFilterProfilesPath(): string { return path.join(this.getConfigDir(), 'filter-profiles.json'); }
  getGoogleSheetsConfigPath(): string { return path.join(this.getConfigDir(), 'google-sheets.json'); }
  getCredentialFilePath(): string { return path.join(this.getCredentialsDir(), 'google-service-account.json'); }
  /**
   * Path to the UI state file (window bounds, last active page).
   * Renderer/UI concerns ONLY — never read by the monitoring engine.
   */
  getUiStatePath(): string { return path.join(this.getConfigDir(), 'ui-state.json'); }

  /** Iteration 12 additions — all UI/maintenance concerns. Never read
   *  by the monitoring engine, scraping pipeline, or SQLite schema. */
  getBackupsDir(): string {
    const p = path.join(this.baseDir, 'backups');
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    return p;
  }
  getFilterOptionsCachePath(): string { return path.join(this.getConfigDir(), 'filter-options-cache.json'); }
  getBrowserProfilePath(): string { return this.getBrowserProfileDir(); }

  isPortableMode(): boolean { return this.isPortable; }
}
