import { create } from 'zustand';
import { MonitoringState, ExportStats } from '../../types/monitoring';

interface MonitoringStore {
  monitoringState: MonitoringState;
  isMonitoring: boolean;
  panelUrl: string;
  exportStats: ExportStats;
  browserConnected: boolean;
  googleConnected: boolean;
  sqliteReady: boolean;
  googleSheetInfo: {
    spreadsheetTitle: string | null;
    worksheetName: string;
    serviceAccountEmail: string;
    lastConnectionTest: Date | null;
  };
  
  setMonitoringState: (state: MonitoringState) => void;
  setIsMonitoring: (isMonitoring: boolean) => void;
  setPanelUrl: (url: string) => void;
  setExportStats: (stats: ExportStats) => void;
  setBrowserConnected: (connected: boolean) => void;
  setGoogleConnected: (connected: boolean) => void;
  setSqliteReady: (ready: boolean) => void;
  setGoogleSheetInfo: (info: any) => void;
}

export const useMonitoringStore = create<MonitoringStore>((set) => ({
  monitoringState: 'IDLE',
  isMonitoring: false,
  panelUrl: '',
  exportStats: {
    pendingQueueCount: 0,
    retryQueueCount: 0,
    successfulExportsToday: 0,
    lastExportTime: null,
    lastExportCount: 0,
    loadedFingerprints: 0,
    storedTransactions: 0,
    transactionsScanned: 0,
    newTransactions: 0,
    duplicatesSkipped: 0,
    rejectedTransactions: 0,
    manualDateMode: true,
    initialSyncMode: false,
    duplicateDetection: true,
    sqliteConnected: false,
    googleSheetsConnected: false,
    unavailableProfiles: []
  },
  browserConnected: false,
  googleConnected: false,
  sqliteReady: true,
  googleSheetInfo: {
    spreadsheetTitle: null,
    worksheetName: 'MASTER',
    serviceAccountEmail: '',
    lastConnectionTest: null
  },
  
  setMonitoringState: (state) => set({ monitoringState: state }),
  setIsMonitoring: (isMonitoring) => set({ isMonitoring }),
  setPanelUrl: (url) => set({ panelUrl: url }),
  setExportStats: (stats) => set({ exportStats: stats }),
  setBrowserConnected: (connected) => set({ browserConnected: connected }),
  setGoogleConnected: (connected) => set({ googleConnected: connected }),
  setSqliteReady: (ready) => set({ sqliteReady: ready }),
  setGoogleSheetInfo: (info) => set({ googleSheetInfo: info })
}));
