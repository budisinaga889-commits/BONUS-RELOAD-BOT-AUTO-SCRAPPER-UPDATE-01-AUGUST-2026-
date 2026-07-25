import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useMonitoringStore } from '../store/monitoring-store';
import LiveLogPanel from '../components/LiveLogPanel';
import MonitoringTimeline from '../components/MonitoringTimeline';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusBadge, { BadgeTone } from '../components/StatusBadge';
import InfoCard, { InfoRow } from '../components/InfoCard';

/**
 * Iteration 11 — professional operator dashboard.
 *
 * The layout targets 1920x1080 above the fold: header + control strip,
 * 5-card KPI row, timeline + live log below. No production logic is
 * altered — every value already flows through the existing exportStats
 * stream and IPC handlers.
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

const MonitoringPage: React.FC = () => {
  const {
    isMonitoring, panelUrl, exportStats, browserConnected,
    googleConnected, sqliteReady, googleSheetInfo, monitoringState,
    setPanelUrl, setIsMonitoring, setBrowserConnected
  } = useMonitoringStore();

  const [validationResult, setValidationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<FilterProfileLite[]>([]);
  const [resumeMarker, setResumeMarker] = useState<ResumeMarkerState>({ keyId: null });
  const [pollingInterval, setPollingInterval] = useState<number>(2);
  const [now, setNow] = useState(Date.now());
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  const [showChecks, setShowChecks] = useState(false);

  // Live "next polling" clock — recompute every second only for display.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

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
    } catch (error: any) {
      console.error('Failed to load config', error);
    }
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
    } catch (error) {
      console.error('Validation failed', error);
    }
  };

  const persistPanelUrl = async (url: string) => {
    if (!window.electron) return;
    try {
      const cfg = await window.electron.getAppConfig();
      if (!cfg.success) return;
      const next = { ...cfg.data, panelUrl: url };
      await window.electron.saveAppConfig(next);
    } catch (e) { /* non-fatal */ }
  };

  const handleOpenBrowser = async () => {
    if (!panelUrl) {
      toast.error('Please enter Panel URL');
      return;
    }
    setLoading(true);
    try {
      const result = await window.electron.launchBrowser(panelUrl);
      if (result.success) {
        setBrowserConnected(true);
        await persistPanelUrl(panelUrl);
        toast.success('Browser opened');
        await validateChecks();
      } else {
        toast.error(result.error || 'Failed to open browser');
      }
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
      if (result.success) {
        setIsMonitoring(true);
        toast.success('Monitoring started');
      } else {
        toast.error(result.error || 'Failed to start');
      }
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

  const enabledProfiles = profiles.filter(p => p.enabled).sort((a, b) => a.priority - b.priority);
  const currentFilter = enabledProfiles[0]?.name || '—';

  const stateBadge = stateTone(monitoringState, isMonitoring);

  const nextPollingIn = useMemo(() => {
    if (!isMonitoring || monitoringState !== 'SLEEPING' || !exportStats.lastExportTime) return null;
    const last = new Date(exportStats.lastExportTime).getTime();
    const remaining = Math.max(0, Math.round((last + pollingInterval * 1000 - now) / 1000));
    return remaining;
  }, [isMonitoring, monitoringState, exportStats.lastExportTime, pollingInterval, now]);

  return (
    <div className="flex flex-col gap-4" data-testid="monitoring-page">
      {/* ---------- Control Strip ---------- */}
      <section className="bg-bg-secondary border border-border-color rounded-md px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <StatusBadge tone={stateBadge.tone} label={stateBadge.label} testId="dashboard-state-badge" />
          <span className="text-xs text-text-tertiary font-mono">{monitoringState}</span>
        </div>

        <div className="flex-1 min-w-[280px] flex items-center gap-2">
          <label className="text-xs text-text-secondary shrink-0">Panel URL</label>
          <input
            type="text"
            data-testid="panel-url-input"
            value={panelUrl}
            onChange={(e) => setPanelUrl(e.target.value)}
            placeholder="https://example.com/panel"
            disabled={isMonitoring}
            className="flex-1 h-8 text-sm px-2"
          />
        </div>

        <div className="flex gap-2">
          <button
            data-testid="open-browser-btn"
            onClick={handleOpenBrowser}
            disabled={loading || browserConnected || isMonitoring}
            className="h-8 px-3 text-sm bg-accent-primary text-white rounded hover:bg-blue-500 disabled:opacity-50"
          >
            Open Browser
          </button>
          <button
            data-testid="close-browser-btn"
            onClick={handleCloseBrowser}
            disabled={loading || !browserConnected || isMonitoring}
            className="h-8 px-3 text-sm bg-bg-tertiary text-text-primary rounded hover:bg-gray-700 disabled:opacity-50"
          >
            Close
          </button>
          <div className="w-px bg-border-color mx-1" />
          <button
            data-testid="start-monitoring-btn"
            onClick={handleStartMonitoring}
            disabled={loading || isMonitoring || !validationResult?.canStartMonitoring}
            className="h-8 px-4 text-sm font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-500 disabled:opacity-50"
          >
            Start Monitoring
          </button>
          <button
            data-testid="stop-monitoring-btn"
            onClick={() => setConfirmStopOpen(true)}
            disabled={loading || !isMonitoring}
            className="h-8 px-3 text-sm bg-red-600 text-white rounded hover:bg-red-500 disabled:opacity-50"
          >
            Stop
          </button>
          <button
            onClick={validateChecks}
            className="h-8 px-3 text-sm bg-bg-tertiary text-text-primary rounded hover:bg-gray-700"
            data-testid="refresh-checks-btn"
          >
            Refresh
          </button>
        </div>
      </section>

      {/* ---------- KPI card strip (5 cards, one row above the fold on 1920x1080) ---------- */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Monitoring */}
        <InfoCard title="Monitoring" testId="card-monitoring">
          <InfoRow label="Status">
            <StatusBadge tone={stateBadge.tone} label={stateBadge.label} size="sm" />
          </InfoRow>
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
          <InfoRow label="Browser">
            <StatusBadge tone={browserConnected ? 'success' : 'neutral'} label={browserConnected ? 'Connected' : 'Idle'} size="sm" testId="health-browser" />
          </InfoRow>
          <InfoRow label="Google Sheets">
            <StatusBadge tone={googleConnected ? 'success' : 'neutral'} label={googleConnected ? 'Connected' : 'Disconnected'} size="sm" testId="health-google" />
          </InfoRow>
          <InfoRow label="SQLite">
            <StatusBadge tone={sqliteReady ? 'success' : 'error'} label={sqliteReady ? 'Ready' : 'Not Ready'} size="sm" testId="health-sqlite" />
          </InfoRow>
          <InfoRow label="Monitoring">
            <StatusBadge tone={isMonitoring ? 'success' : 'neutral'} label={isMonitoring ? 'Running' : 'Stopped'} size="sm" testId="health-monitoring" />
          </InfoRow>
          <InfoRow label="Diagnostic">
            <StatusBadge tone={exportStats.duplicateDetection ? 'success' : 'neutral'} label={exportStats.duplicateDetection ? 'On' : 'Off'} size="sm" />
          </InfoRow>
        </InfoCard>

        {/* Export Statistics */}
        <InfoCard title="Export Statistics" testId="card-export-stats">
          <InfoRow label="Today's Export"><span data-testid="stat-exported-today" className="font-mono">{exportStats.successfulExportsToday}</span></InfoRow>
          <InfoRow label="Duplicates Skipped"><span data-testid="stat-duplicates" className="font-mono">{exportStats.duplicatesSkipped}</span></InfoRow>
          <InfoRow label="Pending Queue"><span data-testid="stat-pending" className="font-mono">{exportStats.pendingQueueCount}</span></InfoRow>
          <InfoRow label="Retry Queue"><span data-testid="stat-retry" className="font-mono">{exportStats.retryQueueCount}</span></InfoRow>
          <InfoRow label="Last Batch"><span className="font-mono">{exportStats.lastExportCount || 0}</span></InfoRow>
          <InfoRow label="Rejected"><span className="font-mono">{exportStats.rejectedTransactions}</span></InfoRow>
        </InfoCard>

        {/* SQLite */}
        <InfoCard title="SQLite" testId="card-sqlite">
          <InfoRow label="Database">
            <StatusBadge tone={sqliteReady ? 'success' : 'error'} label={sqliteReady ? 'Ready' : 'Not Ready'} size="sm" />
          </InfoRow>
          <InfoRow label="Stored Transactions"><span data-testid="stat-stored" className="font-mono">{exportStats.storedTransactions}</span></InfoRow>
          <InfoRow label="Loaded Fingerprints"><span data-testid="stat-fingerprints" className="font-mono">{exportStats.loadedFingerprints}</span></InfoRow>
          <InfoRow label="Scanned This Cycle"><span className="font-mono">{exportStats.transactionsScanned}</span></InfoRow>
          <InfoRow label="Resume Marker">
            <span className="font-mono text-xs" data-testid="stat-resume-marker">{resumeMarker.keyId || '—'}</span>
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
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ minHeight: 300 }}>
        <InfoCard title="Monitoring Timeline" testId="card-timeline" bodyClassName="p-3">
          <MonitoringTimeline />
        </InfoCard>
        <div className="flex flex-col">
          <LiveLogPanel maxEntries={200} height={360} title="Live Log" />
        </div>
      </section>

      {/* ---------- Pre-Run Validation (collapsible footer, secondary info) ---------- */}
      {validationResult && (
        <section className="bg-bg-secondary border border-border-color rounded-md">
          <button
            className="w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-bg-tertiary/40"
            onClick={() => setShowChecks(s => !s)}
            data-testid="prerun-checks-toggle"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-text-secondary">Pre-Run Validation</span>
              <StatusBadge
                tone={validationResult.passed ? 'success' : 'error'}
                label={validationResult.passed ? 'All checks passed' : 'Attention required'}
                size="sm"
              />
            </div>
            <span className="text-text-tertiary text-xs">{showChecks ? '▲' : '▼'}</span>
          </button>
          {showChecks && (
            <div className="p-4 border-t border-border-color grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
              {validationResult.checks.map((check: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm py-1">
                  <StatusBadge tone={check.status ? 'success' : 'error'} label={check.status ? 'OK' : 'Fail'} size="sm" />
                  <span className="text-text-primary">{check.name}</span>
                  {!check.status && (
                    <span className="text-red-400 text-xs ml-2 truncate">{check.error}</span>
                  )}
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
