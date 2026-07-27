import { app, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { AppDirectoryManager } from './app-directory-manager';
import { SQLiteService } from './sqlite-service';
import { ConfigManager } from './config-manager';
import { GoogleSheetsService } from './google-sheets-service';
import { PlaywrightService } from './playwright-service';
import { MonitoringEngine } from './monitoring-engine';
import { getLogger } from './logger-service';

/**
 * MaintenanceService (Iteration 12)
 *
 * Aggregates every read-only "operator" operation the Maintenance page
 * needs. Never modifies the SQLite schema. Never touches the monitoring
 * engine's state machine. VACUUM/ANALYZE run against the existing db
 * handle only after the engine reports it is not actively scanning.
 */
export interface DbHealth {
  ready: boolean;
  sqliteVersion: string;
  databasePath: string;
  databaseSize: number;
  totalTransactions: number;
  totalFingerprints: number;
  resumeMarker: string | null;
  lastVacuumAt: string | null;
  lastBackupAt: string | null;
  integrity: 'ok' | 'fail' | 'unknown';
  walSize: number;
}

export interface CleanupPreview {
  transactionsToDelete: number;
  cutoffDate: string;
}

export interface DiagnosticReport {
  timestamp: string;
  version: { app: string; electron: string; node: string; chrome: string };
  db: DbHealth;
  browser: { connected: boolean; embedded: boolean; path: string | null };
  googleSheets: { connected: boolean; spreadsheetTitle: string | null; worksheet: string | null };
  monitoring: { running: boolean; state: string; enabledProfiles: number };
  paths: { base: string; config: string; database: string; logs: string; backups: string };
}

export class MaintenanceService {
  private metaPath: string;

  constructor(
    private appDirManager: AppDirectoryManager,
    private sqliteService: SQLiteService,
    private configManager: ConfigManager,
    private googleSheetsService: GoogleSheetsService,
    private playwrightService: PlaywrightService,
    private monitoringEngine: MonitoringEngine
  ) {
    this.metaPath = path.join(this.appDirManager.getConfigDir(), 'maintenance-meta.json');
  }

  // ---------- meta helpers ----------
  private readMeta(): any {
    try { return JSON.parse(fs.readFileSync(this.metaPath, 'utf8')); } catch { return {}; }
  }
  private writeMeta(patch: any) {
    const cur = this.readMeta();
    fs.writeFileSync(this.metaPath, JSON.stringify({ ...cur, ...patch }, null, 2), 'utf8');
  }

  // ---------- health ----------
  async getDbHealth(): Promise<DbHealth> {
    const db = this.sqliteService.getDb();
    const dbPath = this.appDirManager.getDatabasePath();
    const meta = this.readMeta();
    let sqliteVersion = 'unknown';
    let integrity: DbHealth['integrity'] = 'unknown';
    let totalTransactions = 0;
    let totalFingerprints = 0;
    let resumeMarker: string | null = null;

    if (db) {
      try { sqliteVersion = (db.prepare('SELECT sqlite_version() as v').get() as any).v; } catch {}
      try {
        const r = db.prepare('PRAGMA integrity_check').get() as any;
        integrity = (r && (r.integrity_check === 'ok')) ? 'ok' : 'fail';
      } catch { integrity = 'fail'; }
      try { totalTransactions = (db.prepare('SELECT COUNT(*) as c FROM transactions').get() as any).c || 0; } catch {}
      try { totalFingerprints = (db.prepare('SELECT COUNT(DISTINCT transaction_fingerprint) as c FROM transactions').get() as any).c || 0; } catch {}
      try {
        const r = db.prepare('SELECT value FROM app_state WHERE key = ?').get('resume_marker') as any;
        resumeMarker = r ? r.value : null;
      } catch {}
    }

    let databaseSize = 0;
    try { databaseSize = fs.statSync(dbPath).size; } catch {}
    let walSize = 0;
    try { walSize = fs.statSync(dbPath + '-wal').size; } catch {}

    return {
      ready: this.sqliteService.isReady(),
      sqliteVersion,
      databasePath: dbPath,
      databaseSize,
      totalTransactions,
      totalFingerprints,
      resumeMarker,
      lastVacuumAt: meta.lastVacuumAt || null,
      lastBackupAt: meta.lastBackupAt || null,
      integrity,
      walSize
    };
  }

  // ---------- optimization ----------
  async vacuum(): Promise<void> {
    if (this.monitoringEngine.getState() !== 'IDLE' && this.monitoringEngine.getState() !== 'SLEEPING') {
      throw new Error('Cannot VACUUM while monitoring is actively scanning. Wait for the current cycle to sleep.');
    }
    const db = this.sqliteService.getDb();
    if (!db) throw new Error('Database not initialized');
    db.exec('VACUUM');
    this.writeMeta({ lastVacuumAt: new Date().toISOString() });
    getLogger().success('SQLite VACUUM completed');
  }
  async analyze(): Promise<void> {
    const db = this.sqliteService.getDb();
    if (!db) throw new Error('Database not initialized');
    db.exec('ANALYZE');
    getLogger().success('SQLite ANALYZE completed');
  }
  async reindex(): Promise<void> {
    const db = this.sqliteService.getDb();
    if (!db) throw new Error('Database not initialized');
    db.exec('REINDEX');
    getLogger().success('SQLite REINDEX completed');
  }

  // ---------- cleanup ----------
  async cleanupPreview(daysToKeep: number): Promise<CleanupPreview> {
    const db = this.sqliteService.getDb();
    if (!db) throw new Error('Database not initialized');
    const cutoff = new Date(Date.now() - daysToKeep * 86_400_000);
    const cutoffStr = cutoff.toISOString().slice(0, 19).replace('T', ' ');
    let count = 0;
    try {
      const r = db.prepare("SELECT COUNT(*) as c FROM transactions WHERE process_date < ?").get(cutoffStr) as any;
      count = r?.c || 0;
    } catch {}
    return { transactionsToDelete: count, cutoffDate: cutoffStr };
  }
  async cleanupExecute(daysToKeep: number): Promise<{ deleted: number }> {
    if (this.monitoringEngine.getState() !== 'IDLE' && this.monitoringEngine.getState() !== 'SLEEPING') {
      throw new Error('Cannot clean up while monitoring is actively scanning.');
    }
    const db = this.sqliteService.getDb();
    if (!db) throw new Error('Database not initialized');
    const cutoff = new Date(Date.now() - daysToKeep * 86_400_000);
    const cutoffStr = cutoff.toISOString().slice(0, 19).replace('T', ' ');
    const res = db.prepare("DELETE FROM transactions WHERE process_date < ?").run(cutoffStr);
    db.exec('VACUUM');
    this.writeMeta({ lastVacuumAt: new Date().toISOString() });
    getLogger().success(`Cleanup complete: ${res.changes} rows removed`);
    return { deleted: Number(res.changes) };
  }

  // ---------- resume marker tools ----------
  async getResumeMarker(): Promise<string | null> {
    const db = this.sqliteService.getDb();
    if (!db) return null;
    try {
      const r = db.prepare('SELECT value FROM app_state WHERE key = ?').get('resume_marker') as any;
      return r ? r.value : null;
    } catch { return null; }
  }
  async setResumeMarker(keyId: string): Promise<void> {
    const db = this.sqliteService.getDb();
    if (!db) throw new Error('Database not initialized');
    db.prepare('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)').run('resume_marker', keyId);
    getLogger().warn(`Resume marker manually overridden -> ${keyId}`);
  }
  async resetResumeMarker(): Promise<void> {
    const db = this.sqliteService.getDb();
    if (!db) throw new Error('Database not initialized');
    db.prepare('DELETE FROM app_state WHERE key = ?').run('resume_marker');
    getLogger().warn('Resume marker RESET');
  }

  // ---------- backup / restore (folder-based) ----------
  private ts(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }
  private copyRecursive(src: string, dst: string) {
    if (!fs.existsSync(src)) return;
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      for (const entry of fs.readdirSync(src)) this.copyRecursive(path.join(src, entry), path.join(dst, entry));
    } else {
      fs.copyFileSync(src, dst);
    }
  }
  async createBackup(mode: 'db-only' | 'full'): Promise<{ path: string }> {
    if (this.monitoringEngine.getState() !== 'IDLE' && this.monitoringEngine.getState() !== 'SLEEPING') {
      throw new Error('Cannot back up while monitoring is actively scanning.');
    }
    const dst = path.join(this.appDirManager.getBackupsDir(), `Backup_${this.ts()}${mode === 'full' ? '_full' : '_db'}`);
    fs.mkdirSync(dst, { recursive: true });

    // Always include the SQLite database (use SQLite's online backup so
    // WAL frames are flushed atomically).
    const db = this.sqliteService.getDb();
    if (db) {
      try { await (db as any).backup(path.join(dst, 'monitoring.db')); }
      catch { this.copyRecursive(this.appDirManager.getDatabasePath(), path.join(dst, 'monitoring.db')); }
    }

    if (mode === 'full') {
      this.copyRecursive(this.appDirManager.getConfigDir(), path.join(dst, 'config'));
      this.copyRecursive(this.appDirManager.getLogsDir(),   path.join(dst, 'logs'));
    }

    const manifest = {
      mode,
      createdAt: new Date().toISOString(),
      version: app.getVersion(),
      contents: fs.readdirSync(dst)
    };
    fs.writeFileSync(path.join(dst, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    this.writeMeta({ lastBackupAt: new Date().toISOString() });
    getLogger().success(`Backup created: ${dst}`);
    return { path: dst };
  }
  async restoreBackup(backupPath: string): Promise<void> {
    if (this.monitoringEngine.getState() !== 'IDLE') {
      throw new Error('Stop monitoring before restoring a backup.');
    }
    const manifestPath = path.join(backupPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) throw new Error('Selected folder is not a valid backup (missing manifest.json).');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    // Restore DB
    const srcDb = path.join(backupPath, 'monitoring.db');
    if (fs.existsSync(srcDb)) {
      this.sqliteService.close();
      fs.copyFileSync(srcDb, this.appDirManager.getDatabasePath());
      // Discard WAL/SHM sidecars because they belonged to the previous DB.
      for (const s of ['-wal', '-shm']) {
        const p = this.appDirManager.getDatabasePath() + s;
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    }
    if (manifest.mode === 'full') {
      const cfgSrc = path.join(backupPath, 'config');
      if (fs.existsSync(cfgSrc)) this.copyRecursive(cfgSrc, this.appDirManager.getConfigDir());
    }
    getLogger().success(`Restore applied from ${backupPath}. Application should restart.`);
  }
  listBackups(): { name: string; path: string; createdAt: string; size: number }[] {
    const dir = this.appDirManager.getBackupsDir();
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(name => {
      try { return fs.statSync(path.join(dir, name)).isDirectory(); } catch { return false; }
    }).map(name => {
      const p = path.join(dir, name);
      const s = fs.statSync(p);
      let manifestCreated = s.birthtime.toISOString();
      try {
        const m = JSON.parse(fs.readFileSync(path.join(p, 'manifest.json'), 'utf8'));
        if (m.createdAt) manifestCreated = m.createdAt;
      } catch {}
      return { name, path: p, createdAt: manifestCreated, size: this.dirSize(p) };
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  private dirSize(p: string): number {
    let total = 0;
    for (const entry of fs.readdirSync(p)) {
      const st = fs.statSync(path.join(p, entry));
      total += st.isDirectory() ? this.dirSize(path.join(p, entry)) : st.size;
    }
    return total;
  }

  // ---------- logs ----------
  async openLogsFolder(): Promise<void> { await shell.openPath(this.appDirManager.getLogsDir()); }
  async exportLogs(destinationDir: string): Promise<{ path: string }> {
    const dst = path.join(destinationDir, `Logs_${this.ts()}`);
    fs.mkdirSync(dst, { recursive: true });
    this.copyRecursive(this.appDirManager.getLogsDir(), dst);
    return { path: dst };
  }
  async clearLogs(): Promise<{ removed: number }> {
    const dir = this.appDirManager.getLogsDir();
    if (!fs.existsSync(dir)) return { removed: 0 };
    let n = 0;
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      const s = fs.statSync(p);
      if (s.isFile() && (f.endsWith('.log') || f.endsWith('.log.gz'))) { fs.unlinkSync(p); n++; }
    }
    return { removed: n };
  }

  // ---------- diagnostic report ----------
  async diagnosticReport(): Promise<DiagnosticReport> {
    const db = await this.getDbHealth();
    const bpath = process.env.PLAYWRIGHT_BROWSERS_PATH || null;
    const embedded = !!bpath && bpath.includes(this.appDirManager.getBaseDir());
    let googleTitle: string | null = null;
    let googleSheet: string | null = null;
    try {
      const gc = await this.configManager.loadGoogleSheetsConfig();
      googleTitle = gc?.spreadsheetTitle || null;
      googleSheet = gc?.worksheetName || null;
    } catch {}
    return {
      timestamp: new Date().toISOString(),
      version: {
        app: app.getVersion(),
        electron: process.versions.electron || '',
        node: process.versions.node || '',
        chrome: process.versions.chrome || ''
      },
      db,
      browser: {
        connected: (this.playwrightService as any).page != null,
        embedded,
        path: bpath
      },
      googleSheets: {
        connected: !!googleTitle,
        spreadsheetTitle: googleTitle,
        worksheet: googleSheet
      },
      monitoring: {
        running: this.monitoringEngine.isMonitoring(),
        state: this.monitoringEngine.getState(),
        enabledProfiles: (await this.configManager.loadFilterProfiles()).filter(p => p.enabled).length
      },
      paths: {
        base: this.appDirManager.getBaseDir(),
        config: this.appDirManager.getConfigDir(),
        database: this.appDirManager.getDatabasePath(),
        logs: this.appDirManager.getLogsDir(),
        backups: this.appDirManager.getBackupsDir()
      }
    };
  }
  async saveDiagnosticReport(destPath: string, format: 'txt' | 'json'): Promise<void> {
    const report = await this.diagnosticReport();
    if (format === 'json') {
      fs.writeFileSync(destPath, JSON.stringify(report, null, 2), 'utf8');
    } else {
      fs.writeFileSync(destPath, this.formatTxt(report), 'utf8');
    }
  }
  private formatTxt(r: DiagnosticReport): string {
    return [
      '============================================================',
      '  LIVE DEPOSIT MONITOR — Diagnostic Report',
      '============================================================',
      `  Generated  : ${r.timestamp}`,
      `  App        : v${r.version.app}`,
      `  Electron   : ${r.version.electron}`,
      `  Node       : ${r.version.node}`,
      `  Chromium   : ${r.version.chrome}`,
      '',
      '-- Database ------------------------------------------------',
      `  Ready         : ${r.db.ready}`,
      `  SQLite        : ${r.db.sqliteVersion}`,
      `  Path          : ${r.db.databasePath}`,
      `  Size          : ${r.db.databaseSize} bytes  (WAL ${r.db.walSize})`,
      `  Transactions  : ${r.db.totalTransactions}`,
      `  Fingerprints  : ${r.db.totalFingerprints}`,
      `  Resume Marker : ${r.db.resumeMarker || '—'}`,
      `  Last VACUUM   : ${r.db.lastVacuumAt || '—'}`,
      `  Last Backup   : ${r.db.lastBackupAt || '—'}`,
      `  Integrity     : ${r.db.integrity}`,
      '',
      '-- Browser -------------------------------------------------',
      `  Connected     : ${r.browser.connected}`,
      `  Embedded      : ${r.browser.embedded}`,
      `  Path          : ${r.browser.path || '(default: ms-playwright)'}`,
      '',
      '-- Google Sheets -------------------------------------------',
      `  Connected     : ${r.googleSheets.connected}`,
      `  Spreadsheet   : ${r.googleSheets.spreadsheetTitle || '—'}`,
      `  Worksheet     : ${r.googleSheets.worksheet || '—'}`,
      '',
      '-- Monitoring ----------------------------------------------',
      `  Running       : ${r.monitoring.running}`,
      `  State         : ${r.monitoring.state}`,
      `  Enabled Prof. : ${r.monitoring.enabledProfiles}`,
      '',
      '-- Paths ---------------------------------------------------',
      `  Base          : ${r.paths.base}`,
      `  Config        : ${r.paths.config}`,
      `  Database      : ${r.paths.database}`,
      `  Logs          : ${r.paths.logs}`,
      `  Backups       : ${r.paths.backups}`,
      '============================================================',
      ''
    ].join('\n');
  }

  // ---------- retry queue ----------
  retryQueueStatus() {
    const stats = (this.monitoringEngine as any).exportStats || {};
    return {
      pending: stats.pendingQueueCount || 0,
      retry: stats.retryQueueCount || 0,
      failed: 0
    };
  }
}
