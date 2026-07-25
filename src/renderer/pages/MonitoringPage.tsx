import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useMonitoringStore } from '../store/monitoring-store';
import LiveLogPanel from '../components/LiveLogPanel';

const MonitoringPage: React.FC = () => {
  const {
    isMonitoring, panelUrl, exportStats, browserConnected,
    googleConnected, sqliteReady, googleSheetInfo,
    setPanelUrl, setIsMonitoring, setBrowserConnected
  } = useMonitoringStore();
  
  const [validationResult, setValidationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    loadConfig();
    validateChecks();
  }, []);
  
  const loadConfig = async () => {
    if (!window.electron) return;
    try {
      const config = await window.electron.getAppConfig();
      if (config.success && config.data.panelUrl) {
        setPanelUrl(config.data.panelUrl);
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
  
  const validateChecks = async () => {
    if (!window.electron) return;
    try {
      const result = await window.electron.validatePreRun();
      if (result.success) setValidationResult(result.data);
    } catch (error) {
      console.error('Validation failed', error);
    }
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
        toast.success('Browser opened');
        await validateChecks();
      } else {
        toast.error(result.error || 'Failed to open browser');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleCloseBrowser = async () => {
    setLoading(true);
    try {
      await window.electron.closeBrowser();
      setBrowserConnected(false);
      toast.success('Browser closed');
    } finally {
      setLoading(false);
    }
  };
  
  const handleStartMonitoring = async () => {
    setLoading(true);
    try {
      const result = await window.electron.startMonitoring(panelUrl);
      if (result.success) {
        setIsMonitoring(true);
        toast.success('Monitoring started');
      } else {
        toast.error(result.error || 'Failed to start');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleStopMonitoring = async () => {
    setLoading(true);
    try {
      await window.electron.stopMonitoring();
      setIsMonitoring(false);
      toast.success('Monitoring stopped');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="space-y-6" data-testid="monitoring-page">
      <h1 className="text-2xl font-bold">Monitoring Dashboard</h1>
      
      {/* Panel Connection */}
      <section className="bg-bg-secondary rounded-lg p-6 border border-border-color">
        <h2 className="text-lg font-semibold mb-4">Panel Connection</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-2">Panel URL</label>
            <input
              type="text"
              data-testid="panel-url-input"
              value={panelUrl}
              onChange={(e) => setPanelUrl(e.target.value)}
              placeholder="https://example.com/panel"
              className="w-full"
              disabled={isMonitoring}
            />
          </div>
          <div className="flex gap-2">
            <button
              data-testid="open-browser-btn"
              onClick={handleOpenBrowser}
              disabled={loading || browserConnected || isMonitoring}
              className="px-4 py-2 bg-accent-primary text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Open Browser
            </button>
            <button
              data-testid="close-browser-btn"
              onClick={handleCloseBrowser}
              disabled={loading || !browserConnected || isMonitoring}
              className="px-4 py-2 bg-bg-tertiary text-text-primary rounded hover:bg-gray-700 disabled:opacity-50"
            >
              Close Browser
            </button>
          </div>
        </div>
      </section>
      
      {/* Monitoring Control */}
      <section className="bg-bg-secondary rounded-lg p-6 border border-border-color">
        <h2 className="text-lg font-semibold mb-4">Monitoring Control</h2>
        <div className="flex gap-2">
          <button
            data-testid="start-monitoring-btn"
            onClick={handleStartMonitoring}
            disabled={loading || isMonitoring || !validationResult?.canStartMonitoring}
            className="px-6 py-3 bg-accent-success text-white rounded hover:bg-green-600 disabled:opacity-50 font-semibold"
          >
            START MONITORING
          </button>
          <button
            data-testid="stop-monitoring-btn"
            onClick={handleStopMonitoring}
            disabled={loading || !isMonitoring}
            className="px-6 py-3 bg-accent-error text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            Stop
          </button>
          <button
            onClick={validateChecks}
            className="px-4 py-3 bg-bg-tertiary text-text-primary rounded hover:bg-gray-700"
          >
            Refresh Status
          </button>
        </div>
      </section>
      
      {/* Connection Status */}
      <section className="bg-bg-secondary rounded-lg p-6 border border-border-color">
        <h2 className="text-lg font-semibold mb-4">Connection Status</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex justify-between items-center py-2 border-b border-border-color">
            <span className="text-text-secondary">Browser</span>
            <span data-testid="status-browser-indicator">{browserConnected ? '🟢 Connected' : '🔴 Disconnected'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border-color">
            <span className="text-text-secondary">Google</span>
            <span data-testid="status-google-indicator">{googleConnected ? '🟢 Connected' : '🔴 Disconnected'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border-color">
            <span className="text-text-secondary">SQLite</span>
            <span data-testid="status-sqlite-indicator">{sqliteReady ? '🟢 Ready' : '🔴 Not Ready'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border-color">
            <span className="text-text-secondary">Monitoring</span>
            <span data-testid="status-monitoring-indicator">{isMonitoring ? '🟢 Running' : '⚪ Idle'}</span>
          </div>
        </div>
        
        {googleSheetInfo.spreadsheetTitle && (
          <div className="mt-6 pt-6 border-t border-border-color">
            <h3 className="text-md font-semibold mb-3">Google Sheets</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-text-secondary">Status: </span>
                <span>{googleConnected ? '🟢 Connected' : '🔴 Disconnected'}</span>
              </div>
              <div>
                <span className="text-text-secondary">Spreadsheet: </span>
                <span data-testid="spreadsheet-title">{googleSheetInfo.spreadsheetTitle}</span>
              </div>
              <div>
                <span className="text-text-secondary">Worksheet: </span>
                <span>{googleSheetInfo.worksheetName}</span>
              </div>
              <div>
                <span className="text-text-secondary">Service Account: </span>
                <span className="text-xs">{googleSheetInfo.serviceAccountEmail}</span>
              </div>
            </div>
          </div>
        )}
      </section>
      
      {/* Export Statistics */}
      <section className="bg-bg-secondary rounded-lg p-6 border border-border-color">
        <h2 className="text-lg font-semibold mb-4">Export Statistics</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-text-secondary text-sm mb-1">Pending Queue</div>
            <div className="text-2xl font-bold" data-testid="pending-queue">{exportStats.pendingQueueCount}</div>
          </div>
          <div>
            <div className="text-text-secondary text-sm mb-1">Retry Queue</div>
            <div className="text-2xl font-bold text-accent-warning" data-testid="retry-queue">{exportStats.retryQueueCount}</div>
          </div>
          <div>
            <div className="text-text-secondary text-sm mb-1">Exported Today</div>
            <div className="text-2xl font-bold text-accent-success" data-testid="exported-today">{exportStats.successfulExportsToday}</div>
          </div>
          <div>
            <div className="text-text-secondary text-sm mb-1">Last Export</div>
            <div className="text-sm" data-testid="last-export">
              {exportStats.lastExportTime 
                ? new Date(exportStats.lastExportTime).toLocaleString()
                : 'No exports yet'}
            </div>
          </div>
        </div>
      </section>
      
      {/* Monitoring Status (live) — surfaces the feature toggles, subsystem
          connections, and pipeline totals so operators can verify the pipeline
          at a glance without reading logs. */}
      <section className="bg-bg-secondary rounded-lg p-6 border border-border-color" data-testid="monitoring-status-section">
        <h2 className="text-lg font-semibold mb-4">Monitoring Status</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex justify-between items-center py-2 border-b border-border-color">
            <span className="text-text-secondary">Manual Date Mode</span>
            <span data-testid="status-manual-date-mode">{exportStats.manualDateMode ? '🟢 ON' : '⚪ OFF'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border-color">
            <span className="text-text-secondary">Initial Sync Mode</span>
            <span data-testid="status-initial-sync-mode">{exportStats.initialSyncMode ? '🟢 ON' : '⚪ OFF'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border-color">
            <span className="text-text-secondary">Duplicate Detection</span>
            <span data-testid="status-duplicate-detection">{exportStats.duplicateDetection ? '🟢 ON' : '⚪ OFF'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border-color">
            <span className="text-text-secondary">SQLite Connection</span>
            <span data-testid="status-sqlite-connection">{exportStats.sqliteConnected ? '🟢 Ready' : '🔴 Not Ready'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border-color">
            <span className="text-text-secondary">Google Sheets Connection</span>
            <span data-testid="status-google-connection">{exportStats.googleSheetsConnected ? '🟢 Connected' : '🔴 Disconnected'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border-color">
            <span className="text-text-secondary">Loaded Fingerprints</span>
            <span className="font-mono" data-testid="status-loaded-fingerprints">{exportStats.loadedFingerprints}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border-color">
            <span className="text-text-secondary">Stored Transactions</span>
            <span className="font-mono" data-testid="status-stored-transactions">{exportStats.storedTransactions}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border-color">
            <span className="text-text-secondary">Export Queue Size</span>
            <span className="font-mono" data-testid="status-export-queue-size">{exportStats.pendingQueueCount + exportStats.retryQueueCount}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border-color col-span-2" data-testid="status-profile-availability-row">
            <span className="text-text-secondary">Profile Availability</span>
            <span data-testid="status-profile-availability">
              {(() => {
                const unavailable = exportStats.unavailableProfiles || [];
                if (unavailable.length === 0) {
                  return isMonitoring ? '🟢 Monitoring Running' : '⚪ Idle';
                }
                // Distinguish "some skipped, others running" from
                // "every enabled profile unavailable — waiting".
                // Note: we cannot know the enabled-count here without
                // extra IPC, so we use the more conservative
                // "profile unavailable — Skipped" phrasing per-profile
                // and let the "Waiting for available payment profile"
                // banner surface via the live log when applicable.
                return `🟡 ${unavailable.join(', ')} profile unavailable — Skipped`;
              })()}
            </span>
          </div>
        </div>
      </section>
      
      {/* Live Statistics (per cycle) */}
      <section className="bg-bg-secondary rounded-lg p-6 border border-border-color" data-testid="live-statistics-section">
        <h2 className="text-lg font-semibold mb-4">Live Statistics</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-text-secondary text-sm mb-1">Transactions Scanned</div>
            <div className="text-2xl font-bold" data-testid="stat-scanned">{exportStats.transactionsScanned}</div>
          </div>
          <div>
            <div className="text-text-secondary text-sm mb-1">New Transactions</div>
            <div className="text-2xl font-bold text-accent-success" data-testid="stat-new">{exportStats.newTransactions}</div>
          </div>
          <div>
            <div className="text-text-secondary text-sm mb-1">Duplicates Skipped</div>
            <div className="text-2xl font-bold text-accent-warning" data-testid="stat-duplicates">{exportStats.duplicatesSkipped}</div>
          </div>
          <div>
            <div className="text-text-secondary text-sm mb-1">Rejected</div>
            <div className="text-2xl font-bold text-accent-error" data-testid="stat-rejected">{exportStats.rejectedTransactions}</div>
          </div>
          <div>
            <div className="text-text-secondary text-sm mb-1">Exported Today</div>
            <div className="text-2xl font-bold text-accent-success" data-testid="stat-exported">{exportStats.successfulExportsToday}</div>
          </div>
          <div>
            <div className="text-text-secondary text-sm mb-1">Current Export Queue</div>
            <div className="text-2xl font-bold" data-testid="stat-queue">{exportStats.pendingQueueCount + exportStats.retryQueueCount}</div>
          </div>
        </div>
      </section>
      
      {/* Pre-Run Validation */}
      {validationResult && (
        <section className="bg-bg-secondary rounded-lg p-6 border border-border-color">
          <h2 className="text-lg font-semibold mb-4">Pre-Run Validation</h2>
          <div className="space-y-2">
            {validationResult.checks.map((check: any, i: number) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <span>{check.icon}</span>
                <span>{check.status ? '✅' : '❌'}</span>
                <span>{check.name}</span>
                {!check.status && (
                  <span className="text-accent-error text-xs">{check.error}</span>
                )}
              </div>
            ))}
          </div>
          <div className={`mt-4 text-sm ${validationResult.passed ? 'text-accent-success' : 'text-accent-error'}`}>
            {validationResult.passed ? '✅ All checks passed. Ready to monitor.' : '❌ Cannot start monitoring. Fix errors above.'}
          </div>
        </section>
      )}
      
      {/* Live Log — streams Winston entries from the main process in real time. */}
      <LiveLogPanel maxEntries={200} height={280} />
    </div>
  );
};

export default MonitoringPage;
