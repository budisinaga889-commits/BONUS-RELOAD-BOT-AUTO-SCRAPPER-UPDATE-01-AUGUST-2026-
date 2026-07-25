export interface CycleMetrics {
  cycleId: string;
  timestamp: Date;
  filterName: string;
  rowsParsed: number;
  validTransactions: number;
  invalidTransactions: number;
  skippedTransactions: number;
  duplicateTransactions: number;
  newTransactions: number;
  exportedTransactions: number;
  cycleTimeMs: number;
}

export interface ExportStats {
  pendingQueueCount: number;
  retryQueueCount: number;
  successfulExportsToday: number;
  lastExportTime: Date | null;
  lastExportCount: number;
  // Live dashboard counters (updated during monitoring)
  loadedFingerprints: number;
  storedTransactions: number;
  transactionsScanned: number;
  newTransactions: number;
  duplicatesSkipped: number;
  rejectedTransactions: number;
  // Status flags surfaced to the dashboard
  manualDateMode: boolean;
  initialSyncMode: boolean;
  duplicateDetection: boolean;
  sqliteConnected: boolean;
  googleSheetsConnected: boolean;
  // [FILTER PROFILE] Profiles that were NOT AVAILABLE during the most
  // recently completed monitoring cycle. Populated by the filter-
  // selection layer; used by the dashboard status card only. Never
  // triggers any pipeline fallback.
  unavailableProfiles?: string[];
}

export interface PreRunCheck {
  name: string;
  status: boolean;
  icon: string;
  error?: string;
}

export interface PreRunValidation {
  passed: boolean;
  checks: PreRunCheck[];
  canStartMonitoring: boolean;
}

export type MonitoringState = 
  | 'IDLE'
  | 'LOADING_FILTERS'
  | 'SCANNING_PAGE'
  | 'PARSING_HTML'
  | 'VALIDATING'
  | 'CHECKING_DUPLICATES'
  | 'BUFFERING'
  | 'EXPORTING'
  | 'UPDATING_CACHE'
  | 'SLEEPING'
  | 'ERROR'
  | 'PAUSED';

export interface LogEntry {
  timestamp: Date;
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'DEBUG';
  module: string;
  message: string;
  meta?: any;
}
