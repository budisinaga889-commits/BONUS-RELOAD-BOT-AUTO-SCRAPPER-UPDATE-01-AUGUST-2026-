import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useMonitoringStore } from '../store/monitoring-store';

const GoogleSheetsPage: React.FC = () => {
  const { setGoogleConnected, setGoogleSheetInfo } = useMonitoringStore();
  const [credentialPath, setCredentialPath] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'disconnected'>('idle');
  const [testing, setTesting] = useState(false);
  const [spreadsheetTitle, setSpreadsheetTitle] = useState<string>('');
  const [lastTest, setLastTest] = useState<Date | null>(null);
  
  useEffect(() => {
    loadConfig();
  }, []);
  
  const loadConfig = async () => {
    if (!window.electron) return;
    const result = await window.electron.loadGoogleConfig();
    if (result.success && result.data) {
      setCredentialPath(result.data.credentialJsonPath || '');
      setSpreadsheetId(result.data.spreadsheetId || '');
      setServiceAccountEmail(result.data.serviceAccountEmail || '');
      setSpreadsheetTitle(result.data.spreadsheetTitle || '');
      setLastTest(result.data.lastConnectionTest ? new Date(result.data.lastConnectionTest) : null);
      setConnectionStatus(result.data.isConnected ? 'connected' : 'disconnected');
    }
  };
  
  const handleBrowse = async () => {
    const result = await window.electron.browseCredential();
    if (result.success && result.data) {
      setCredentialPath(result.data);
      toast.success('Credential selected');
    }
  };
  
  const handleSave = async () => {
    if (!credentialPath || !spreadsheetId) {
      toast.error('Credential and Spreadsheet ID are required');
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
    } catch (error: any) {
      toast.error(error.message);
    }
  };
  
  const handleTestConnection = async () => {
    if (!credentialPath || !spreadsheetId) {
      toast.error('Configure credential and Spreadsheet ID first');
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
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setTesting(false);
    }
  };
  
  return (
    <div className="space-y-6" data-testid="google-sheets-page">
      <h1 className="text-2xl font-bold">Google Sheets Connection</h1>
      
      <section className="bg-bg-secondary rounded-lg p-6 border border-border-color">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-2">Credential JSON</label>
            <div className="flex gap-2">
              <input
                data-testid="credential-path-input"
                type="text"
                value={credentialPath}
                readOnly
                placeholder="Click Browse to select..."
                className="flex-1"
              />
              <button
                data-testid="browse-credential-btn"
                onClick={handleBrowse}
                className="px-4 py-2 bg-accent-primary text-white rounded hover:bg-blue-600"
              >
                Browse
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-text-secondary mb-2">Spreadsheet ID</label>
            <input
              data-testid="spreadsheet-id-input"
              type="text"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              placeholder="1a2b3c4d5e6f..."
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm text-text-secondary mb-2">Worksheet</label>
            <input
              type="text"
              value="MASTER"
              readOnly
              className="w-full bg-bg-primary"
            />
            <p className="text-xs text-text-tertiary mt-1">Fixed by design (Read Only)</p>
          </div>
          
          <div className="border-t border-border-color pt-4 space-y-2">
            <div>
              <span className="text-text-secondary">Service Account: </span>
              <span data-testid="service-account-email">{serviceAccountEmail || '-'}</span>
            </div>
            <div>
              <span className="text-text-secondary">Credential Status: </span>
              <span>{credentialPath ? '✅ Loaded' : '⚪ Not loaded'}</span>
            </div>
            <div>
              <span className="text-text-secondary">Connection Status: </span>
              <span data-testid="connection-status">
                {connectionStatus === 'connected' && '🟢 Connected'}
                {connectionStatus === 'disconnected' && '🔴 Disconnected'}
                {connectionStatus === 'idle' && '⚪ Not tested'}
              </span>
            </div>
            {spreadsheetTitle && (
              <div>
                <span className="text-text-secondary">Spreadsheet: </span>
                <span>{spreadsheetTitle}</span>
              </div>
            )}
            {lastTest && (
              <div>
                <span className="text-text-secondary">Last Test: </span>
                <span>{lastTest.toLocaleString()}</span>
              </div>
            )}
          </div>
          
          <div className="flex gap-2 pt-4">
            <button
              data-testid="save-config-btn"
              onClick={handleSave}
              disabled={!credentialPath || !spreadsheetId}
              className="px-4 py-2 bg-accent-primary text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Save Configuration
            </button>
            <button
              data-testid="test-connection-btn"
              onClick={handleTestConnection}
              disabled={testing || !credentialPath || !spreadsheetId}
              className="px-4 py-2 bg-accent-success text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default GoogleSheetsPage;
