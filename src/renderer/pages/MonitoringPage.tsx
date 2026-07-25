import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useMonitoringStore } from '../store/monitoring-store';
import LiveLogPanel from '../components/LiveLogPanel';
import MonitoringTimeline from '../components/MonitoringTimeline';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusBadge, { BadgeTone } from '../components/StatusBadge';
import InfoCard, { InfoRow } from '../components/InfoCard';

/**
 * Iteration 11.1 — visual polish only.
 *
 * Layout constraints (unchanged from 11):
 *   1. Everything fits above the fold at 1920x1080.
 *   2. 5 KPI cards on a single row, then timeline + live log below.
 * Refinements:
 *   - Larger primary KPI values (mono, tabular, ~16px) → 3-second glance test
 *   - Tighter grid gap (3 instead of 4)
 *   - Smaller control-strip height (h-11) → more vertical room for cards
 *   - Timeline + Live Log grid is a fixed 260px block, no scroll on 1080
 */

interface FilterProfileLite { id: string; name: string; priority: number; enabled: boolean; }
interface ResumeMarkerState { keyId: string | null; }

const stateTone = (state: string, isMonitoring: boolean): { tone: BadgeTone; label: string } => {
  if (!isMonitoring) return { tone: 'neutral', label: 'Stopped' };
  switch (state) {
    case 'IDLE':                return { tone: 'neutral', label: 'Idle' };
    case 'SLEEPING':            return { tone: 'warning', label: 'Waiting' };
    case 'ERROR':               return { tone: 'error',   label: 'Error' };
    case 'LOADING_FILTERS':
    case 'SCANNING_PAGE':
    case 'PARSING_HTML':
    case 'VALIDATING':
    case 'CHECKING_DUPLICATES':
    case 'BUFFERING':
    case 'EXPORTING':
    case 'UPDATING_CACHE':      return { tone: 'info',    label: 'Processing' };
    case 'PAUSED':              return { tone: 'warning', label: 'Paused' };
    default:                    return { tone: 'success', label: 'Running' };
  }
};

/** Big KPI row: label + hero value + optional badge/subtext. */
const Kpi: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode; testId?: string }> = ({ label, value, sub, testId }) => (
  <div className="flex items-baseline justify-between py-[6px]" data-testid={testId}>
    <span className="text-[12px] text-text-secondary">{label}</span>
    <span className="text-[15px] font-medium text-text-primary text-kpi">{value}</span>
    {sub && <span className="ml-2 text-[10.5px] text-text-tertiary tabular-nums">{sub}</span>}
  </div>
);

const MonitoringPage: React.FC = () => {
  const {
    isMonitoring, panelUrl, exportStats, browserConnected,
    googleConnected, sqliteReady, googleSheetInfo, monitoringState,
    setPanelUrl, setIsMonitoring, setBrowserConnected
  } = useMonitoringStore();

  const [validationResult, setValidationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<FilterProfileLite[]>([]);
  const [resumeMarker] = useState<ResumeMarkerState>({ keyId: null });
  const [pollingInterval, setPollingInterval] = useState<number>(2);
  const [now, setNow] = useState(Date.now());
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  const [showChecks, setShowChecks] = useState(false);

  useEffect(() => {
    if (!isMonitoring || monitoringState !== 'SLEEPING') return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [isMonitoring, monitoringState]);

  useEffect(() => {
    loadConfig();
    loadProfiles();
    validateChecks();
  }, []);

  const loadConfig = async () => {
    if (!window.electron) return;
    try {
      const config = await window.electron.getAppConfig();
      if (config.success) {
        if (config.data.panelUrl) setPanelUrl(config.data.panelUrl);
        if (config.data.monitoring?.pollingInterval) setPollingInterval(config.data.monitoring.pollingInterval);
      }
      const googleConfig = await window.electron.loadGoogleConfig();
      if (googleConfig.success && googleConfig.data) {
        useMonitoringStore.setState({
          googleConnected: googleConfig.data.isConnected,
          googleSheetInfo: {
            spreadsheetTitle: googleConfig.data.spreadsheetTitle,
            worksheetName: googleConfig.data.worksheetName,
            serviceAccountEmail: googleConfig.data.serviceAccountEmail,
            lastConnectionTest: googleConfig.data.lastConnectionTest
          }
        });
      }
    } catch (error: any) { console.error('Failed to load config', error); }
  };

  const loadProfiles = async () => {
    if (!window.electron) return;
    const res = await window.electron.getFilters();
    if (res.success) setProfiles(res.data);
  };

  const validateChecks = async () => {
    if (!window.electron) return;
    try {
      const result = await window.electron.validatePreRun();
      if (result.success) setValidationResult(result.data);
    } catch (error) { console.error('Validation failed', error); }
  };

  const persistPanelUrl = async (url: string) => {
    if (!window.electron) return;
    try {
      const cfg = await window.electron.getAppConfig();
      if (!cfg.success) return;
      await window.electron.saveAppConfig({ ...cfg.data, panelUrl: url });
    } catch { /* non-fatal */ }
  };

  const handleOpenBrowser = async () => {
    if (!panelUrl) { toast.error('Please enter Panel URL'); return; }
    setLoading(true);
    try {
      const result = await window.electron.launchBrowser(panelUrl);
      if (result.success) {
        setBrowserConnected(true);
        await persistPanelUrl(panelUrl);
        toast.success('Browser opened');
        await validateChecks();
      } else { toast.error(result.error || 'Failed to open browser'); }
    } finally { setLoading(false); }
  };

  const handleCloseBrowser = async () => {
    setLoading(true);
    try {
      await window.electron.closeBrowser();
      setBrowserConnected(false);
      toast.success('Browser closed');
    } finally { setLoading(false); }
  };

  const handleStartMonitoring = async () => {
    setLoading(true);
    try {
      await persistPanelUrl(panelUrl);
      const result = await window.electron.startMonitoring(panelUrl);
      if (result.success) { setIsMonitoring(true); toast.success('Monitoring started'); }
      else                { toast.error(result.error || 'Failed to start'); }
    } finally { setLoading(false); }
  };

  const doStopMonitoring = async () => {
    setConfirmStopOpen(false);
    setLoading(true);
    try {
      await window.electron.stopMonitoring();
      setIsMonitoring(false);
      toast.success('Monitoring stopped');
    } finally { setLoading(false); }
  };

  const enabledProfiles = useMemo(
    () => profiles.filter(p => p.enabled).sort((a, b) => a.priority - b.priority),
    [profiles]
  );
  const currentFilter = enabledProfiles[0]?.name || '—';

  const stateBadge = stateTone(monitoringState, isMonitoring);

  const nextPollingIn = useMemo(() => {
    if (!isMonitoring || monitoringState !== 'SLEEPING' || !exportStats.lastExportTime) return null;
    const last = new Date(exportStats.lastExportTime).getTime();
    return Math.max(0, Math.round((last + pollingInterval * 1000 - now) / 1000));
  }, [isMonitoring, monitoringState, exportStats.lastExportTime, pollingInterval, now]);

  const btnPrimary   = 'h-8 px-3 text-[12.5px] font-medium bg-accent-primary text-white rounded hover:bg-accent-strong disabled:opacity-45';
  const btnSecondary = 'h-8 px-3 text-[12.5px] font-medium bg-bg-tertiary text-text-primary rounded border border-border-color hover:border-border-strong disabled:opacity-45';
  const btnSuccess   = 'h-8 px-4 text-[12.5px] font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-500 disabled:opacity-45';
  const btnDanger    = 'h-8 px-3 text-[12.5px] font-medium bg-rose-600 text-white rounded hover:bg-rose-500 disabled:opacity-45';

  return (
    <div className="flex flex-col gap-3" data-testid="monitoring-page">
      {/* ---------- Control Strip ---------- */}
      <section className="bg-bg-secondary border border-border-color rounded-md shadow-card h-11 px-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <StatusBadge tone={stateBadge.tone} label={stateBadge.label} testId="dashboard-state-badge" />
          <span className="text-[10.5px] text-text-muted font-mono tracking-wider">{monitoringState}</span>
        </div>
        <div className="w-px h-4 bg-border-color" />

        <div className="flex-1 min-w-[280px] flex items-center gap-2">
          <label className="text-[11.5px] text-text-secondary shrink-0">Panel URL</label>
          <input
            type="text"
            data-testid="panel-url-input"
            value={panelUrl}
            onChange={(e) => setPanelUrl(e.target.value)}
            placeholder="https://example.com/panel"
            disabled={isMonitoring}
            className="flex-1 h-7 text-[12.5px]"
          />
        </div>

        <div className="flex gap-1.5">
          <button data-testid="open-browser-btn"    onClick={handleOpenBrowser}                 disabled={loading || browserConnected || isMonitoring} className={btnPrimary}>Open Browser</button>
          <button data-testid="close-browser-btn"   onClick={handleCloseBrowser}                disabled={loading || !browserConnected || isMonitoring} className={btnSecondary}>Close</button>
          <div className="w-px h-6 self-center bg-border-color mx-0.5" />
          <button data-testid="start-monitoring-btn" onClick={handleStartMonitoring}           disabled={loading || isMonitoring || !validationResult?.canStartMonitoring} className={btnSuccess}>Start Monitoring</button>
          <button data-testid="stop-monitoring-btn"  onClick={() => setConfirmStopOpen(true)}  disabled={loading || !isMonitoring} className={btnDanger}>Stop</button>
          <button data-testid="refresh-checks-btn"   onClick={validateChecks}                   className={btnSecondary}>Refresh</button>
        </div>
      </section>

      {/* ---------- KPI card strip (5 cards on 1920x1080) ---------- */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Monitoring */}
        <InfoCard title="Monitoring" testId="card-monitoring">
          <InfoRow label="Status"><StatusBadge tone={stateBadge.tone} label={stateBadge.label} size="sm" /></InfoRow>
          <InfoRow label="Current Filter"><span data-testid="current-filter">{currentFilter}</span></InfoRow>
          <InfoRow label="Enabled Profiles"><span data-testid="enabled-profile-count">{enabledProfiles.length}</span></InfoRow>
          <InfoRow label="Last Export">
            {exportStats.lastExportTime
              ? new Date(exportStats.lastExportTime).toLocaleTimeString([], { hour12: false })
              : '—'}
          </InfoRow>
          <InfoRow label="Next Polling">
            {nextPollingIn !== null ? `${nextPollingIn}s` : (isMonitoring ? 'Active' : '—')}
          </InfoRow>
        </InfoCard>

        {/* System Health */}
        <InfoCard title="System Health" testId="card-system-health">
          <InfoRow label="Browser">      <StatusBadge tone={browserConnected ? 'success' : 'neutral'} label={browserConnected ? 'Connected' : 'Idle'}          size="sm" testId="health-browser" /></InfoRow>
          <InfoRow label="Google Sheets"><StatusBadge tone={googleConnected  ? 'success' : 'neutral'} label={googleConnected  ? 'Connected' : 'Disconnected'} size="sm" testId="health-google"   /></InfoRow>
          <InfoRow label="SQLite">       <StatusBadge tone={sqliteReady     ? 'success' : 'error'  } label={sqliteReady     ? 'Ready'     : 'Not Ready'}    size="sm" testId="health-sqlite"  /></InfoRow>
          <InfoRow label="Monitoring">   <StatusBadge tone={isMonitoring    ? 'success' : 'neutral'} label={isMonitoring    ? 'Running'   : 'Stopped'}      size="sm" testId="health-monitoring" /></InfoRow>
          <InfoRow label="Diagnostic">   <StatusBadge tone={exportStats.duplicateDetection ? 'success' : 'neutral'} label={exportStats.duplicateDetection ? 'On' : 'Off'} size="sm" /></InfoRow>
        </InfoCard>

        {/* Export Statistics — mono/tabular KPI values */}
        <InfoCard title="Export Statistics" testId="card-export-stats">
          <Kpi label="Today's Export"    value={<span data-testid="stat-exported-today">{exportStats.successfulExportsToday}</span>} />
          <Kpi label="Duplicates Skipped" value={<span data-testid="stat-duplicates">{exportStats.duplicatesSkipped}</span>} />
          <Kpi label="Pending Queue"     value={<span data-testid="stat-pending">{exportStats.pendingQueueCount}</span>} />
          <Kpi label="Retry Queue"       value={<span data-testid="stat-retry">{exportStats.retryQueueCount}</span>} />
          <Kpi label="Last Batch"        value={exportStats.lastExportCount || 0} />
        </InfoCard>

        {/* SQLite */}
        <InfoCard title="SQLite" testId="card-sqlite">
          <InfoRow label="Database"><StatusBadge tone={sqliteReady ? 'success' : 'error'} label={sqliteReady ? 'Ready' : 'Not Ready'} size="sm" /></InfoRow>
          <Kpi label="Stored"         value={<span data-testid="stat-stored">{exportStats.storedTransactions}</span>} />
          <Kpi label="Fingerprints"   value={<span data-testid="stat-fingerprints">{exportStats.loadedFingerprints}</span>} />
          <Kpi label="Scanned Cycle"  value={exportStats.transactionsScanned} />
          <InfoRow label="Resume Marker">
            <span data-testid="stat-resume-marker" className="font-mono text-[11px] text-text-tertiary">{resumeMarker.keyId || '—'}</span>
          </InfoRow>
        </InfoCard>

        {/* Google Sheets */}
        <InfoCard title="Google Sheets" testId="card-google-sheets">
          <InfoRow label="Status">
            <StatusBadge tone={googleConnected ? 'success' : 'neutral'} label={googleConnected ? 'Connected' : 'Not Connected'} size="sm" />
          </InfoRow>
          <InfoRow label="Spreadsheet">
            <span className="truncate max-w-[160px] text-right" title={googleSheetInfo.spreadsheetTitle || ''}>
              {googleSheetInfo.spreadsheetTitle || '—'}
            </span>
          </InfoRow>
          <InfoRow label="Worksheet"><span className="font-mono">{googleSheetInfo.worksheetName || '—'}</span></InfoRow>
          <InfoRow label="Last Test">
            {googleSheetInfo.lastConnectionTest
              ? new Date(googleSheetInfo.lastConnectionTest).toLocaleTimeString([], { hour12: false })
              : '—'}
          </InfoRow>
          <InfoRow label="Last Export">
            {exportStats.lastExportTime
              ? new Date(exportStats.lastExportTime).toLocaleTimeString([], { hour12: false })
              : '—'}
          </InfoRow>
        </InfoCard>
      </section>

      {/* ---------- Timeline + Live Log ---------- */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3" style={{ minHeight: 260 }}>
        <InfoCard title="Monitoring Timeline" testId="card-timeline" bodyClassName="p-2">
          <MonitoringTimeline />
        </InfoCard>
        <LiveLogPanel maxEntries={200} height={296} title="Live Log" />
      </section>

      {/* ---------- Pre-Run Validation (collapsible footer) ---------- */}
      {validationResult && (
        <section className="bg-bg-secondary border border-border-color rounded-md shadow-card overflow-hidden">
          <button
            className="w-full text-left px-3 h-9 flex items-center justify-between hover:bg-white/[0.02]"
            onClick={() => setShowChecks(s => !s)}
            data-testid="prerun-checks-toggle"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-text-tertiary">Pre-Run Validation</span>
              <StatusBadge
                tone={validationResult.passed ? 'success' : 'error'}
                label={validationResult.passed ? 'All checks passed' : 'Attention required'}
                size="sm"
              />
            </div>
            <span className="text-text-muted text-[11px]">{showChecks ? '▲' : '▼'}</span>
          </button>
          {showChecks && (
            <div className="px-3 py-2.5 border-t border-border-color grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
              {validationResult.checks.map((check: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-[12.5px] py-1">
                  <StatusBadge tone={check.status ? 'success' : 'error'} label={check.status ? 'OK' : 'Fail'} size="sm" />
                  <span className="text-text-primary">{check.name}</span>
                  {!check.status && <span className="text-rose-300 text-[11px] ml-2 truncate">{check.error}</span>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <ConfirmDialog
        open={confirmStopOpen}
        title="Stop monitoring?"
        description="Any in-flight cycle will finish the current row batch, then the loop will stop. Buffered rows already persisted to SQLite are safe and will export on the next start."
        confirmLabel="Stop Monitoring"
        cancelLabel="Keep Running"
        tone="danger"
        onConfirm={doStopMonitoring}
        onCancel={() => setConfirmStopOpen(false)}
        testId="confirm-stop-monitoring"
      />
    </div>
  );
};

export default MonitoringPage;
