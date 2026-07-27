import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import InfoCard, { InfoRow } from '../components/InfoCard';
import StatusBadge, { BadgeTone } from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { CardIcon } from '../components/CardIcons';

/**
 * Iteration 12 — Maintenance Center + Application Reset.
 *
 * Purely operator-facing: reads and mutates *local files only*, never
 * touches the monitoring engine or the SQLite schema. VACUUM, ANALYZE
 * and Cleanup are gated on the engine reporting IDLE/SLEEPING before
 * they run (enforced main-side by MaintenanceService).
 */

const kb = (b?: number) => {
  if (b === undefined || b === null) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(2)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
};

const btnPrimary   = 'h-8 px-3 text-[12px] font-medium bg-accent-primary text-white rounded hover:bg-accent-strong disabled:opacity-45';
const btnSecondary = 'h-8 px-3 text-[12px] font-medium bg-bg-tertiary text-text-primary rounded border border-border-color hover:border-border-strong disabled:opacity-45';
const btnWarning   = 'h-8 px-3 text-[12px] font-medium bg-amber-600 text-white rounded hover:bg-amber-500 disabled:opacity-45';
const btnDanger    = 'h-8 px-3 text-[12px] font-medium bg-rose-600 text-white rounded hover:bg-rose-500 disabled:opacity-45';

type ConfirmSpec = {
  title: string;
  description?: React.ReactNode;
  affectList?: string[];
  preserveList?: string[];
  action: () => Promise<any>;
  onSuccess?: (res: any) => void;
  tone?: 'danger' | 'primary';
  confirmLabel?: string;
};

const MaintenancePage: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
  const [restartPromptOpen, setRestartPromptOpen] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [cleanupPreview, setCleanupPreview] = useState<any>(null);
  const [cleanupDays, setCleanupDays] = useState<number>(30);
  const [customDays, setCustomDays] = useState<number>(30);
  const [backups, setBackups] = useState<any[]>([]);
  const [resumeInput, setResumeInput] = useState<string>('');
  const [retry, setRetry] = useState<any>(null);

  useEffect(() => {
    refreshHealth();
    refreshBackups();
    refreshRetry();
  }, []);

  const refreshHealth = async () => {
    if (!window.electron?.maintDbHealth) return;
    const r = await window.electron.maintDbHealth();
    if (r?.success) { setHealth(r.data); setResumeInput(r.data.resumeMarker || ''); }
  };
  const refreshBackups = async () => {
    if (!window.electron?.maintBackupList) return;
    const r = await window.electron.maintBackupList();
    if (r?.success) setBackups(r.data || []);
  };
  const refreshRetry = async () => {
    if (!window.electron?.maintRetryQueue) return;
    const r = await window.electron.maintRetryQueue();
    if (r?.success) setRetry(r.data);
  };

  const run = async (label: string, fn: () => Promise<any>, onOk?: (r: any) => void) => {
    setBusy(true);
    try {
      const r = await fn();
      if (r?.success === false) { toast.error(r.error || `${label} failed`); return; }
      toast.success(`${label} completed`);
      onOk?.(r?.data);
    } catch (e: any) { toast.error(e?.message || String(e)); }
    finally { setBusy(false); }
  };

  const askConfirm = (spec: ConfirmSpec) => setConfirm(spec);

  const executeConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      const res = await confirm.action();
      if (res?.success === false) toast.error(res.error || 'Failed');
      else {
        confirm.onSuccess?.(res?.data);
        toast.success('Done');
      }
    } catch (e: any) { toast.error(e?.message || String(e)); }
    finally { setBusy(false); setConfirm(null); }
  };

  const doPreviewCleanup = async () => {
    const days = cleanupDays === -1 ? customDays : cleanupDays;
    const r = await window.electron.maintCleanupPreview(days);
    if (r?.success) setCleanupPreview({ ...r.data, days });
    else toast.error(r?.error || 'Preview failed');
  };

  const dbTone = (integrity: string, ready: boolean): { tone: BadgeTone; label: string } => {
    if (!ready) return { tone: 'error', label: 'Not Ready' };
    if (integrity === 'ok') return { tone: 'success', label: 'Healthy' };
    return { tone: 'warning', label: 'Check integrity' };
  };
  const db = health && dbTone(health.integrity, health.ready);

  return (
    <div className="flex flex-col gap-4 max-w-[1400px]" data-testid="maintenance-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Maintenance & Operations</h1>
          <p className="text-[11.5px] text-text-tertiary mt-0.5">Backups, cleanup, diagnostics and safe application reset.</p>
        </div>
        <div className="flex gap-2">
          <button data-testid="maint-refresh" onClick={() => { refreshHealth(); refreshBackups(); refreshRetry(); }} className={btnSecondary}>Refresh</button>
          <button data-testid="maint-diag-txt" onClick={() => run('Diagnostic TXT', () => window.electron.maintDiagSave('txt'))} className={btnPrimary} disabled={busy}>Save Diagnostic (TXT)</button>
          <button data-testid="maint-diag-json" onClick={() => run('Diagnostic JSON', () => window.electron.maintDiagSave('json'))} className={btnSecondary} disabled={busy}>JSON</button>
        </div>
      </div>

      {/* ===== Row 1 — Health + Storage ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <InfoCard title="Database Health" icon={<CardIcon.sqlite />} testId="card-db-health">
          {!health ? <div className="text-text-tertiary text-sm">Loading…</div> : (
            <>
              <InfoRow label="Status"><StatusBadge tone={db!.tone} label={db!.label} size="sm" testId="db-status-badge" /></InfoRow>
              <InfoRow label="SQLite Version"><span className="font-mono" data-testid="db-sqlite-version">{health.sqliteVersion}</span></InfoRow>
              <InfoRow label="Database Size"><span data-testid="db-size">{kb(health.databaseSize)}</span></InfoRow>
              <InfoRow label="WAL Size">{kb(health.walSize)}</InfoRow>
              <InfoRow label="Total Transactions"><span data-testid="db-total-tx">{(health.totalTransactions || 0).toLocaleString()}</span></InfoRow>
              <InfoRow label="Total Fingerprints"><span data-testid="db-total-fp">{(health.totalFingerprints || 0).toLocaleString()}</span></InfoRow>
              <InfoRow label="Resume Marker"><span className="font-mono text-[11px]">{health.resumeMarker || '—'}</span></InfoRow>
              <InfoRow label="Last VACUUM">{health.lastVacuumAt ? new Date(health.lastVacuumAt).toLocaleString() : '—'}</InfoRow>
              <InfoRow label="Last Backup">{health.lastBackupAt ? new Date(health.lastBackupAt).toLocaleString() : '—'}</InfoRow>
              <InfoRow label="Integrity"><span className="font-mono">{health.integrity}</span></InfoRow>
            </>
          )}
        </InfoCard>

        <InfoCard title="Database Optimization" icon={<CardIcon.wrench />} testId="card-db-opt">
          <p className="text-[11.5px] text-text-secondary mb-3">Safe read/rebuild operations. Never delete data. Blocked while a scan is in progress.</p>
          <div className="flex flex-wrap gap-2">
            <button data-testid="btn-vacuum"  onClick={() => askConfirm({ title: 'Run VACUUM?', description: 'Rebuilds the database file to reclaim space. Never deletes data.', action: () => window.electron.maintVacuum(), onSuccess: refreshHealth })} className={btnPrimary} disabled={busy}>VACUUM</button>
            <button data-testid="btn-analyze" onClick={() => run('ANALYZE', () => window.electron.maintAnalyze())} className={btnSecondary} disabled={busy}>ANALYZE</button>
            <button data-testid="btn-reindex" onClick={() => askConfirm({ title: 'Run REINDEX?', description: 'Rebuilds every index. May take a while on large databases.', action: () => window.electron.maintReindex() })} className={btnSecondary} disabled={busy}>REINDEX</button>
          </div>
          <div className="mt-4 pt-3 border-t border-border-color">
            <div className="text-[10.5px] uppercase tracking-[0.09em] text-text-muted mb-2">Cleanup Old Data</div>
            <div className="flex flex-wrap gap-2 items-center">
              <select data-testid="cleanup-preset" value={cleanupDays} onChange={e => setCleanupDays(Number(e.target.value))} className="h-8 text-[12px] px-2">
                <option value={7}>Older than 7 days</option>
                <option value={30}>Older than 30 days</option>
                <option value={60}>Older than 60 days</option>
                <option value={90}>Older than 90 days</option>
                <option value={-1}>Custom…</option>
              </select>
              {cleanupDays === -1 && (
                <input type="number" min={1} value={customDays} onChange={e => setCustomDays(Number(e.target.value))} className="h-8 w-20 text-[12px]" data-testid="cleanup-custom-days" />
              )}
              <button data-testid="cleanup-preview" onClick={doPreviewCleanup} className={btnSecondary}>Preview</button>
              {cleanupPreview && (
                <button
                  data-testid="cleanup-execute"
                  onClick={() => askConfirm({
                    title: `Delete ${cleanupPreview.transactionsToDelete.toLocaleString()} transactions?`,
                    description: `Rows older than ${cleanupPreview.cutoffDate} will be removed. VACUUM will run automatically after cleanup.`,
                    tone: 'danger',
                    confirmLabel: 'Delete',
                    action: () => window.electron.maintCleanupExecute(cleanupPreview.days),
                    onSuccess: (r) => { toast.success(`${r.deleted} rows deleted`); setCleanupPreview(null); refreshHealth(); }
                  })}
                  className={btnDanger}
                  disabled={busy}
                >
                  Delete {cleanupPreview.transactionsToDelete.toLocaleString()}
                </button>
              )}
            </div>
            {cleanupPreview && (
              <div className="text-[11px] text-text-tertiary mt-1.5" data-testid="cleanup-preview-line">
                Cutoff: <span className="font-mono">{cleanupPreview.cutoffDate}</span> · rows: <span className="font-mono">{cleanupPreview.transactionsToDelete.toLocaleString()}</span>
              </div>
            )}
          </div>
        </InfoCard>

        <InfoCard title="Resume Marker" icon={<CardIcon.monitoring />} testId="card-resume-marker">
          <InfoRow label="Current"><span className="font-mono text-[11px]" data-testid="resume-current">{health?.resumeMarker || '—'}</span></InfoRow>
          <div className="mt-3">
            <label className="block text-[10.5px] uppercase tracking-[0.09em] text-text-muted mb-1">Override</label>
            <input data-testid="resume-input" value={resumeInput} onChange={e => setResumeInput(e.target.value)} className="w-full h-8 text-[12px]" placeholder="e.g. 2026-01-15 14:32:10||AB12..." />
            <div className="flex gap-2 mt-2">
              <button
                data-testid="btn-resume-set"
                onClick={() => askConfirm({
                  title: 'Override Resume Marker?',
                  description: 'This changes where the next monitoring cycle resumes. Do NOT use unless you understand the marker format.',
                  action: () => window.electron.maintResumeSet(resumeInput),
                  onSuccess: refreshHealth
                })}
                className={btnWarning}
                disabled={!resumeInput || busy}
              >
                Set
              </button>
              <button
                data-testid="btn-resume-reset"
                onClick={() => askConfirm({
                  title: 'Reset Resume Marker?',
                  description: 'Next monitoring cycle will start from the first available page. Use this for a fresh resync.',
                  tone: 'danger',
                  action: () => window.electron.maintResumeReset(),
                  onSuccess: refreshHealth
                })}
                className={btnDanger}
                disabled={busy}
              >
                Reset
              </button>
            </div>
          </div>
        </InfoCard>
      </div>

      {/* ===== Row 2 — Backups + Retry Queue + Logs ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <InfoCard title="Backups" icon={<CardIcon.export />} testId="card-backups">
          <div className="flex gap-2 mb-3">
            <button data-testid="backup-db" onClick={() => run('DB backup', () => window.electron.maintBackupCreate('db-only'), refreshBackups)} className={btnPrimary} disabled={busy}>DB Only</button>
            <button data-testid="backup-full" onClick={() => run('Full backup', () => window.electron.maintBackupCreate('full'), refreshBackups)} className={btnSecondary} disabled={busy}>Full Backup</button>
          </div>
          <div className="border-t border-border-color pt-2 max-h-56 overflow-auto -mx-3 px-3">
            {backups.length === 0 ? (
              <div className="text-[11.5px] text-text-tertiary py-2">No backups yet.</div>
            ) : (
              <ul className="space-y-1">
                {backups.map((b: any) => (
                  <li key={b.path} className="flex items-center justify-between gap-2 text-[11.5px] py-1 border-b border-border-color/60 last:border-0" data-testid="backup-row">
                    <div className="min-w-0">
                      <div className="font-mono text-[11.5px] truncate">{b.name}</div>
                      <div className="text-[10.5px] text-text-tertiary tabular-nums">
                        {new Date(b.createdAt).toLocaleString()} · {kb(b.size)}
                      </div>
                    </div>
                    <button
                      onClick={() => askConfirm({
                        title: 'Restore this backup?',
                        description: 'The database file will be replaced. Monitoring must be stopped. Application should be restarted after restore.',
                        tone: 'danger',
                        confirmLabel: 'Restore',
                        action: () => window.electron.maintBackupRestore(b.path),
                        onSuccess: () => setRestartPromptOpen({ open: true, message: 'Backup restored. Please restart the application to reload the database.' })
                      })}
                      className="text-[11px] px-2 py-1 rounded bg-bg-tertiary border border-border-color hover:border-border-strong"
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </InfoCard>

        <InfoCard title="Retry Queue" icon={<CardIcon.monitoring />} testId="card-retry-queue">
          <InfoRow label="Pending Queue"><span data-testid="retry-pending" className="font-mono">{retry?.pending ?? '—'}</span></InfoRow>
          <InfoRow label="Retry Queue"><span data-testid="retry-count" className="font-mono">{retry?.retry ?? '—'}</span></InfoRow>
          <InfoRow label="Failed Exports"><span data-testid="retry-failed" className="font-mono">{retry?.failed ?? 0}</span></InfoRow>
          <div className="text-[11px] text-text-tertiary mt-2">
            Buffered exports flush automatically on the next successful monitoring cycle. Retry mechanics live inside the untouched monitoring engine.
          </div>
        </InfoCard>

        <InfoCard title="Log Manager" icon={<CardIcon.log />} testId="card-log-manager">
          <div className="flex flex-col gap-2">
            <button data-testid="log-open" onClick={() => run('Open log folder', () => window.electron.maintLogsOpen())} className={btnPrimary} disabled={busy}>Open Log Folder</button>
            <button data-testid="log-export" onClick={() => run('Export logs', () => window.electron.maintLogsExport())} className={btnSecondary} disabled={busy}>Export Logs</button>
            <button data-testid="log-clear" onClick={() => askConfirm({
              title: 'Clear all log files?',
              description: 'Removes .log and .log.gz files from the local logs folder. Running processes will start writing fresh log files.',
              tone: 'danger', confirmLabel: 'Clear',
              action: () => window.electron.maintLogsClear()
            })} className={btnDanger} disabled={busy}>Clear Logs</button>
          </div>
        </InfoCard>
      </div>

      {/* ===== Row 3 — Configuration Management ===== */}
      <InfoCard title="Configuration Management" icon={<CardIcon.system />} testId="card-config-mgmt">
        <div className="flex flex-wrap gap-2">
          <button data-testid="config-export" onClick={() => run('Configuration export', () => window.electron.exportConfiguration())} className={btnPrimary} disabled={busy}>Export Configuration</button>
          <button data-testid="config-import" onClick={() => askConfirm({
            title: 'Import configuration?',
            description: 'App config, filter profiles and Google Sheets settings will be overwritten by the selected file. Database and credentials remain untouched.',
            action: () => window.electron.importConfiguration()
          })} className={btnSecondary} disabled={busy}>Import Configuration</button>
        </div>
        <div className="text-[11px] text-text-tertiary mt-2">
          Included: Panel URL, Monitoring settings, Filter Profiles, Google Sheets config (id/worksheet reference — service-account credential file is NOT bundled).
        </div>
      </InfoCard>

      {/* ===== Row 4 — Application Reset ===== */}
      <ApplicationReset onFinished={(msg) => setRestartPromptOpen({ open: true, message: msg })} askConfirm={askConfirm} busy={busy} />

      {/* ---------- generic confirmation dialog ---------- */}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ''}
        description={
          <>
            {confirm?.description}
            {(confirm?.affectList || confirm?.preserveList) && (
              <div className="mt-3 space-y-2">
                {confirm.affectList && (
                  <div>
                    <div className="text-[10.5px] uppercase tracking-[0.09em] text-rose-300 mb-1">Will be removed</div>
                    <ul className="text-[11.5px] space-y-0.5">
                      {confirm.affectList.map((x, i) => <li key={i}>✕ {x}</li>)}
                    </ul>
                  </div>
                )}
                {confirm.preserveList && (
                  <div>
                    <div className="text-[10.5px] uppercase tracking-[0.09em] text-emerald-300 mb-1">Will NOT be affected</div>
                    <ul className="text-[11.5px] space-y-0.5">
                      {confirm.preserveList.map((x, i) => <li key={i}>✓ {x}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        }
        confirmLabel={confirm?.confirmLabel || 'Continue'}
        cancelLabel="Cancel"
        tone={confirm?.tone || 'primary'}
        onConfirm={executeConfirm}
        onCancel={() => setConfirm(null)}
        testId="maint-confirm-dialog"
      />

      {/* ---------- restart prompt ---------- */}
      <ConfirmDialog
        open={restartPromptOpen.open}
        title="Application Reset completed"
        description={<>{restartPromptOpen.message}<div className="mt-2 text-text-secondary">Some changes will take effect after restarting the application.</div></>}
        confirmLabel="Restart Now"
        cancelLabel="Restart Later"
        onConfirm={async () => { setRestartPromptOpen({ open: false, message: '' }); await window.electron.restartApp(); }}
        onCancel={() => setRestartPromptOpen({ open: false, message: '' })}
        testId="restart-prompt-dialog"
      />
    </div>
  );
};

/* ============================================================
   Application Reset — grouped by severity per spec.
   ============================================================ */
const ApplicationReset: React.FC<{
  onFinished: (message: string) => void;
  askConfirm: (spec: ConfirmSpec) => void;
  busy: boolean;
}> = ({ onFinished, askConfirm, busy }) => {
  const [keepFilters, setKeepFilters] = useState(true);
  const [keepGoogle, setKeepGoogle] = useState(true);

  const btn = 'h-8 px-3 text-[12px] font-medium rounded border';

  return (
    <InfoCard title="Application Reset" icon={<CardIcon.wrench />} testId="card-app-reset">
      <p className="text-[11.5px] text-text-secondary mb-3">
        Recover from local configuration issues without reinstalling. Grouped by severity — safer actions on the left, advanced on the right. Monitoring database and history are never affected.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* SAFE */}
        <div className="border border-emerald-500/25 bg-emerald-500/[0.03] rounded-md p-3" data-testid="reset-group-safe">
          <div className="text-[10.5px] uppercase tracking-[0.09em] font-semibold text-emerald-300 mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Safe Reset
          </div>
          <div className="flex flex-col gap-2">
            <button
              data-testid="reset-window-layout"
              onClick={() => askConfirm({
                title: 'Reset Window Layout?',
                affectList: ['Window size', 'Window position', 'Sidebar state', 'Last active page', 'Dashboard layout'],
                preserveList: ['Database', 'Logs', 'Settings', 'Filter Profiles'],
                action: () => window.electron.resetWindowLayout(),
                onSuccess: (r) => onFinished(r?.message || 'Window layout reset')
              })}
              className={`${btn} bg-bg-tertiary border-border-color text-text-primary hover:border-emerald-500/50`}
              disabled={busy}
            >Reset Window Layout</button>

            <button
              data-testid="reset-ui-prefs"
              onClick={() => askConfirm({
                title: 'Reset UI Preferences?',
                affectList: ['Table column widths', 'Sort states', 'Local UI cache', 'Notification preferences'],
                preserveList: ['Application configuration'],
                action: () => window.electron.resetUiPreferences(),
                onSuccess: (r) => onFinished(r?.message || 'UI preferences reset')
              })}
              className={`${btn} bg-bg-tertiary border-border-color text-text-primary hover:border-emerald-500/50`}
              disabled={busy}
            >Reset UI Preferences</button>

            <button
              data-testid="reset-cached-metadata"
              onClick={() => askConfirm({
                title: 'Reset Cached Browser Metadata?',
                affectList: ['Cached Bank list', 'Cached Payment list', 'Cached dropdown metadata'],
                preserveList: ['Filter Profiles'],
                action: () => window.electron.resetCachedMetadata(),
                onSuccess: (r) => onFinished(r?.message || 'Cached metadata cleared')
              })}
              className={`${btn} bg-bg-tertiary border-border-color text-text-primary hover:border-emerald-500/50`}
              disabled={busy}
            >Reset Cached Metadata</button>
          </div>
        </div>

        {/* MEDIUM */}
        <div className="border border-amber-500/30 bg-amber-500/[0.03] rounded-md p-3" data-testid="reset-group-medium">
          <div className="text-[10.5px] uppercase tracking-[0.09em] font-semibold text-amber-300 mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Medium Reset
          </div>
          <div className="flex flex-col gap-2">
            <button
              data-testid="reset-panel-session"
              onClick={() => askConfirm({
                title: 'Reset Panel Session?',
                affectList: ['Cookies', 'Local Storage', 'Session Storage'],
                preserveList: ['Database', 'Settings', 'Filter Profiles', 'Google configuration'],
                tone: 'danger',
                action: () => window.electron.resetPanelSession(),
                onSuccess: (r) => onFinished(r?.message || 'Panel session cleared')
              })}
              className={`${btn} bg-bg-tertiary border-border-color text-text-primary hover:border-amber-500/60`}
              disabled={busy}
            >Reset Panel Session</button>
            <button
              data-testid="reset-local-config"
              onClick={() => askConfirm({
                title: 'Reset Local Configuration?',
                affectList: ['Monitoring settings', 'UI configuration', 'Panel URL', 'Window state', 'Local preferences'],
                preserveList: ['SQLite Database', 'Stored Transactions', 'Fingerprints', 'Resume Marker', 'Google credentials', 'Filter Profiles'],
                tone: 'danger',
                confirmLabel: 'Reset',
                action: () => window.electron.resetLocalConfig(),
                onSuccess: (r) => onFinished(r?.message || 'Local configuration reset')
              })}
              className={`${btn} bg-bg-tertiary border-border-color text-text-primary hover:border-amber-500/60`}
              disabled={busy}
            >Reset Local Configuration</button>
          </div>
        </div>

        {/* ADVANCED */}
        <div className="border border-rose-500/40 bg-rose-500/[0.03] rounded-md p-3" data-testid="reset-group-advanced">
          <div className="text-[10.5px] uppercase tracking-[0.09em] font-semibold text-rose-300 mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Advanced Reset
          </div>
          <div className="flex flex-col gap-2 text-[11.5px]">
            <label className="flex items-center gap-2 text-text-secondary">
              <input type="checkbox" checked={keepFilters} onChange={e => setKeepFilters(e.target.checked)} data-testid="full-keep-filters" />
              Keep Filter Profiles
            </label>
            <label className="flex items-center gap-2 text-text-secondary">
              <input type="checkbox" checked={keepGoogle} onChange={e => setKeepGoogle(e.target.checked)} data-testid="full-keep-google" />
              Keep Google Sheets configuration
            </label>
            <button
              data-testid="reset-full"
              onClick={() => askConfirm({
                title: 'Reset Everything (Except Monitoring Database)?',
                affectList: [
                  'UI state',
                  'App configuration',
                  'Panel URL',
                  'Window layout',
                  'Panel session',
                  'Cached metadata',
                  ...(!keepFilters ? ['Filter Profiles'] : []),
                  ...(!keepGoogle ? ['Google Sheets configuration'] : []),
                ],
                preserveList: [
                  'SQLite Database (monitoring.db)',
                  'Stored Transactions',
                  'Fingerprints',
                  'Resume Marker',
                  ...(keepFilters ? ['Filter Profiles'] : []),
                  ...(keepGoogle ? ['Google Sheets configuration'] : []),
                ],
                tone: 'danger',
                confirmLabel: 'Reset Everything',
                action: () => window.electron.resetFull({ keepFilterProfiles: keepFilters, keepGoogleConfig: keepGoogle }),
                onSuccess: (r) => onFinished(r?.message || 'Full reset complete')
              })}
              className={`${btn} bg-rose-600 border-rose-500 text-white hover:bg-rose-500`}
              disabled={busy}
            >Reset Everything</button>
          </div>
        </div>
      </div>
    </InfoCard>
  );
};

export default MaintenancePage;
