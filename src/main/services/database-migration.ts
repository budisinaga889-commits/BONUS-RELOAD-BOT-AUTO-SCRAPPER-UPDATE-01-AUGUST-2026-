import Database from 'better-sqlite3';
import { getLogger } from './logger-service';

interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

export class DatabaseMigration {
  private migrations: Migration[] = [
    {
      version: 1,
      name: 'initial_schema',
      up: (db: Database.Database) => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_fingerprint TEXT NOT NULL UNIQUE,
            user_id TEXT NOT NULL,
            account_number TEXT NOT NULL,
            amount REAL NOT NULL,
            process_date TEXT NOT NULL,
            filter_profile TEXT NOT NULL,
            export_status TEXT NOT NULL DEFAULT 'pending',
            exported_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE INDEX IF NOT EXISTS idx_fingerprint ON transactions(transaction_fingerprint);
          CREATE INDEX IF NOT EXISTS idx_process_date ON transactions(process_date);
          CREATE INDEX IF NOT EXISTS idx_export_status ON transactions(export_status);
          CREATE INDEX IF NOT EXISTS idx_created_at ON transactions(created_at);
          
          CREATE TABLE IF NOT EXISTS app_state (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          
          INSERT OR IGNORE INTO schema_version (version) VALUES (1);
        `);
      }
    }
  ];
  
  constructor(private db: Database.Database) {}
  
  async migrate(): Promise<void> {
    const logger = getLogger();
    const currentVersion = this.getCurrentVersion();
    logger.info(`Current database version: ${currentVersion}`);
    
    const pendingMigrations = this.migrations.filter(m => m.version > currentVersion);
    
    if (pendingMigrations.length === 0) {
      logger.info('Database is up to date');
      return;
    }
    
    for (const migration of pendingMigrations) {
      logger.info(`Applying migration ${migration.version}: ${migration.name}`);
      
      const transaction = this.db.transaction(() => {
        migration.up(this.db);
        this.db.prepare('UPDATE schema_version SET version = ?').run(migration.version);
      });
      
      transaction();
      logger.info(`Migration ${migration.version} applied`);
    }
  }
  
  private getCurrentVersion(): number {
    try {
      const result = this.db.prepare(
        'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
      ).get() as { version: number } | undefined;
      
      return result?.version || 0;
    } catch (error) {
      return 0;
    }
  }
}
