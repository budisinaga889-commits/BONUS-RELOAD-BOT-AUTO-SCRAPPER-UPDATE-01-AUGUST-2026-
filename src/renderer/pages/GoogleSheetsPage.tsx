import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useMonitoringStore } from '../store/monitoring-store';
import StatusBadge from '../components/StatusBadge';
import InfoCard from '../components/InfoCard';

/**
 * Google Sheets — Iteration 11 UX improvement.
 *
 * The operator may paste a full Google Sheets URL. The Spreadsheet ID
 * is extracted client-side; the backend still receives the raw ID via
 * the SAME `google:save-config` / `google:test-connection` IPC handlers
 * used before. No backend behaviour changes.
 *
 * Supported URL shapes:
 *   https://docs.google.com/spreadsheets/d/<ID>/edit
 *   https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0
 *   https://docs.google.com/spreadsheets/d/<ID>/
 *   https://docs.google.com/spreadsheets/d/<ID>
 * A raw ID pasted directly (25+ URL-safe characters) is accepted as-is.
 */
const SPREADSHEET_ID_RX = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
const RAW_ID_RX = /^[a-zA-Z0-9-_]{25,}$/;

function extractSpreadsheetId(raw: string): { id: string | null; source: 'url' | 'raw' | 'invalid' } {
  const s = (raw || '').trim();
  if (!s) return { id: null, source: 'invalid' };
  const m = s.match(SPREADSHEET_ID_RX);
  if (m && m[1]) return { id: m[1], source: 'url' };
  if (RAW_ID_RX.test(s)) return { id: s, source: 'raw' };
  return { id: null, source: 'invalid' };
}

const GoogleSheetsPage: React.FC = () => {
  const { setGoogleConnected, setGoogleSheetInfo } = useMonitoringStore();
  const [credentialPath, setCredentialPath] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'disconnected'>('idle');
  const [testing, setTesting] = useState(false);
  const [spreadsheetTitle, setSpreadsheetTitle] = useState<string>('');
  const [lastTest, setLastTest] = useState<Date | null>(null);

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    if (!window.electron) return;
    const result = await window.electron.loadGoogleConfig();
    if (result.success && result.data) {
      setCredentialPath(result.data.credentialJsonPath || '');
      setSpreadsheetId(result.data.spreadsheetId || '');
      setUrlInput(result.data.spreadsheetId
        ? `https://docs.google.com/spreadsheets/d/${result.data.spreadsheetId}/edit`
        : '');
      setServiceAccountEmail(result.data.serviceAccountEmail || '');
      setSpreadsheetTitle(result.data.spreadsheetTitle || '');
      setLastTest(result.data.lastConnectionTest ? new Date(result.data.lastConnectionTest) : null);
      setConnectionStatus(result.data.isConnected ? 'connected' : 'disconnected');
    }
  };

  const parsed = useMemo(() => extractSpreadsheetId(urlInput), [urlInput]);
  useEffect(() => { if (parsed.id) setSpreadsheetId(parsed.id); }, [parsed.id]);

  const handleBrowse = async () => {
    const result = await window.electron.browseCredential();
    if (result.success && result.data) {
      setCredentialPath(result.data);
      toast.success('Credential selected');
    }
  };

  const handleSave = async () => {
    if (!credentialPath || !spreadsheetId) {
      toast.error('Credential and Spreadsheet URL are required');
      return;
    }
    try {
      const result = await window.electron.saveGoogleConfig(credentialPath, spreadsheetId);
      if (result.success) {
        toast.success('Configuration saved');
        loadConfig();
      } else {
        toast.error(result.error || 'Save failed');
      }
    } catch (error: any) { toast.error(error.message); }
  };

  const handleTestConnection = async () => {
    if (!credentialPath || !spreadsheetId) {
      toast.error('Configure credential and Spreadsheet URL first');
      return;
    }
    setTesting(true);
    try {
      const result = await window.electron.testGoogleConnection(credentialPath, spreadsheetId);
      if (result.success && result.data.success) {
        setConnectionStatus('connected');
        setServiceAccountEmail(result.data.serviceAccountEmail || '');
        setSpreadsheetTitle(result.data.spreadsheetTitle || '');
        setLastTest(new Date());
        setGoogleConnected(true);
        setGoogleSheetInfo({
          spreadsheetTitle: result.data.spreadsheetTitle,
          worksheetName: 'MASTER',
          serviceAccountEmail: result.data.serviceAccountEmail,
          lastConnectionTest: new Date()
        });
        toast.success(result.data.message);
      } else {
        setConnectionStatus('disconnected');
        toast.error(result.data?.error || result.error || 'Connection failed');
      }
    } catch (error: any) { toast.error(error.message); }
    finally { setTesting(false); }
  };

  const urlValid = parsed.id !== null || urlInput.trim() === '';
  const canSave = credentialPath && spreadsheetId && urlValid;

  return (
    <div className="space-y-6 max-w-4xl" data-testid="google-sheets-page">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Google Sheets Connection</h1>
        <StatusBadge
          tone={connectionStatus === 'connected' ? 'success' : connectionStatus === 'disconnected' ? 'error' : 'neutral'}
          label={connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'disconnected' ? 'Disconnected' : 'Not tested'}
          testId="connection-status"
        />
      </div>

      <InfoCard title="Credentials" testId="google-credentials-card">
        <label className="block text-xs text-text-secondary mb-1">Service Account JSON</label>
        <div className="flex gap-2">
          <input
            data-testid="credential-path-input"
            type="text"
            value={credentialPath}
            readOnly
            placeholder="Click Browse to select…"
            className="flex-1 h-9 text-sm"
          />
          <button
            data-testid="browse-credential-btn"
            onClick={handleBrowse}
            className="h-9 px-3 text-sm bg-accent-primary text-white rounded hover:bg-blue-500"
          >
            Browse
          </button>
        </div>
        <div className="mt-2 text-xs text-text-tertiary">
          Credential file will be copied into the app's private credentials folder.
        </div>
      </InfoCard>

      <InfoCard title="Spreadsheet" testId="google-spreadsheet-card">
        <label className="block text-xs text-text-secondary mb-1">Google Sheets URL</label>
        <input
          data-testid="spreadsheet-url-input"
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/xxxxxxxxxxxxxxxxxxxxxxxx/edit"
          className={`w-full h-9 text-sm ${urlInput && !parsed.id ? 'border-red-500' : ''}`}
        />
        {urlInput && !parsed.id && (
          <div className="mt-1 text-xs text-red-400" data-testid="spreadsheet-url-error">
            Invalid URL. Paste the full Google Sheets URL, e.g. https://docs.google.com/spreadsheets/d/&lt;ID&gt;/edit
          </div>
        )}
        {parsed.id && (
          <div className="mt-2 text-xs text-text-tertiary">
            Detected Spreadsheet ID: <span className="font-mono text-text-secondary" data-testid="detected-spreadsheet-id">{parsed.id}</span>
            <span className="ml-2 text-text-tertiary">({parsed.source === 'url' ? 'parsed from URL' : 'raw ID'})</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Worksheet</label>
            <input type="text" value="MASTER" readOnly className="w-full h-9 text-sm bg-bg-primary" />
            <p className="text-[11px] text-text-tertiary mt-1">Fixed by design (read-only)</p>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Service Account</label>
            <input type="text" readOnly value={serviceAccountEmail || '—'} className="w-full h-9 text-sm bg-bg-primary" data-testid="service-account-email" />
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <button
            data-testid="save-config-btn"
            onClick={handleSave}
            disabled={!canSave}
            className="h-9 px-4 text-sm bg-accent-primary text-white rounded hover:bg-blue-500 disabled:opacity-50"
          >
            Save Configuration
          </button>
          <button
            data-testid="test-connection-btn"
            onClick={handleTestConnection}
            disabled={testing || !canSave}
            className="h-9 px-4 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-500 disabled:opacity-50"
          >
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
        </div>
      </InfoCard>

      {spreadsheetTitle && (
        <InfoCard title="Connection Details">
          <div className="text-sm text-text-secondary">
            <div className="py-1">Spreadsheet: <span className="text-text-primary">{spreadsheetTitle}</span></div>
            {lastTest && <div className="py-1">Last Test: <span className="text-text-primary">{lastTest.toLocaleString()}</span></div>}
          </div>
        </InfoCard>
      )}
    </div>
  );
};

export default GoogleSheetsPage;
