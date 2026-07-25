import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useMonitoringStore } from '../store/monitoring-store';
import { AppConfig } from '../../types/config';

const SettingsPage: React.FC = () => {
  const { isMonitoring } = useMonitoringStore();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    loadConfig();
  }, []);
  
  const loadConfig = async () => {
    if (!window.electron) return;
    const result = await window.electron.getAppConfig();
    if (result.success) setConfig(result.data);
  };
  
  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const result = await window.electron.saveAppConfig(config);
      if (result.success) toast.success('Settings saved');
      else toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };
  
  if (!config) return <div>Loading...</div>;
  
  return (
    <div className="space-y-6" data-testid="settings-page">
      <h1 className="text-2xl font-bold">Settings</h1>
      
      {isMonitoring && (
        <div className="bg-accent-warning bg-opacity-20 border border-accent-warning rounded p-3 text-sm">
          ⚠️ Some settings cannot be changed while monitoring is active
        </div>
      )}
      
      <section className="bg-bg-secondary rounded-lg p-6 border border-border-color">
        <h2 className="text-lg font-semibold mb-4">Monitoring</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Polling Interval (seconds)</label>
            <input
              type="number"
              value={config.monitoring.pollingInterval}
              onChange={(e) => setConfig({
                ...config,
                monitoring: { ...config.monitoring, pollingInterval: parseInt(e.target.value) }
              })}
              disabled={isMonitoring}
              min={1} max={30}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Max Page Scan</label>
            <input
              type="number"
              value={config.monitoring.maxPageScan}
              onChange={(e) => setConfig({
                ...config,
                monitoring: { ...config.monitoring, maxPageScan: parseInt(e.target.value) }
              })}
              min={1}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Retry Count</label>
            <input
              type="number"
              value={config.monitoring.retryCount}
              onChange={(e) => setConfig({
                ...config,
                monitoring: { ...config.monitoring, retryCount: parseInt(e.target.value) }
              })}
              min={0}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Batch Size</label>
            <input
              type="number"
              value={config.monitoring.batchSize}
              onChange={(e) => setConfig({
                ...config,
                monitoring: { ...config.monitoring, batchSize: parseInt(e.target.value) }
              })}
              min={1}
              className="w-full"
            />
          </div>
        </div>
      </section>
      
      <section className="bg-bg-secondary rounded-lg p-6 border border-border-color">
        <h2 className="text-lg font-semibold mb-4">Database</h2>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Cleanup Days</label>
          <input
            type="number"
            value={config.database.cleanupDays}
            onChange={(e) => setConfig({
              ...config,
              database: { cleanupDays: parseInt(e.target.value) }
            })}
            min={1}
            className="w-full"
          />
        </div>
      </section>
      
      <section className="bg-bg-secondary rounded-lg p-6 border border-border-color">
        <h2 className="text-lg font-semibold mb-4">Features</h2>
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              data-testid="toggle-manual-date-mode"
              checked={config.features.manualDateMode !== false}
              onChange={(e) => setConfig({
                ...config,
                features: { ...config.features, manualDateMode: e.target.checked }
              })}
              className="mt-1"
            />
            <div>
              <div className="font-medium">Manual Date Mode</div>
              <div className="text-sm text-text-secondary">
                When enabled, the operator manually selects the monitoring dates in the browser.
                The Monitoring Engine never modifies those dates — it only verifies that both fields contain values.
                If either field is empty, the monitoring cycle is aborted with a clear operator message.
              </div>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              data-testid="toggle-initial-sync-mode"
              checked={config.features.initialSyncMode === true}
              onChange={(e) => setConfig({
                ...config,
                features: { ...config.features, initialSyncMode: e.target.checked }
              })}
              className="mt-1"
            />
            <div>
              <div className="font-medium">Initial Sync Mode</div>
              <div className="text-sm text-text-secondary">
                When enabled, existing fingerprints, the latest processed transaction, and adaptive scanning are ignored.
                Scanning starts from page 1 and every valid transaction is exported.
                Intended ONLY for first deployment, database rebuild, and recovery after database reset.
              </div>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              data-testid="toggle-diagnostic-logging"
              checked={config.features.diagnosticLogging === true}
              onChange={(e) => setConfig({
                ...config,
                features: { ...config.features, diagnosticLogging: e.target.checked }
              })}
              className="mt-1"
            />
            <div>
              <div className="font-medium">Diagnostic Logging</div>
              <div className="text-sm text-text-secondary">
                Emits rich per-cycle diagnostic blocks (filter payload, header resolution, per-row rejection reasons, pagination widget state) to the Live Log.
              </div>
            </div>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.features.screenshotOnError}
              onChange={(e) => setConfig({
                ...config,
                features: { ...config.features, screenshotOnError: e.target.checked }
              })}
            />
            <span>Screenshot on Error</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.features.autoResume}
              onChange={(e) => setConfig({
                ...config,
                features: { ...config.features, autoResume: e.target.checked }
              })}
            />
            <span>Auto Resume</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.features.autoReconnect}
              onChange={(e) => setConfig({
                ...config,
                features: { ...config.features, autoReconnect: e.target.checked }
              })}
            />
            <span>Auto Reconnect</span>
          </label>
        </div>
      </section>
      
      <button
        data-testid="save-settings-btn"
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-3 bg-accent-primary text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
};

export default SettingsPage;
