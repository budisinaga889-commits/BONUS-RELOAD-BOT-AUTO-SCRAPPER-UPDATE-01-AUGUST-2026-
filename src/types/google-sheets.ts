export interface GoogleSheetsConfig {
  credentialJsonPath: string;
  spreadsheetId: string;
  worksheetName: 'MASTER';
  serviceAccountEmail: string;
  spreadsheetTitle: string | null;
  isConnected: boolean;
  headersValidated: boolean;
  headersInitialized: boolean;
  lastConnectionTest: Date | null;
  lastError: string | null;
}

export interface ConnectionTestResult {
  success: boolean;
  serviceAccountEmail?: string;
  spreadsheetTitle?: string;
  worksheetName?: string;
  message: string;
  headersInitialized?: boolean;
  error?: string;
}

export interface HeaderValidationResult {
  valid: boolean;
  empty: boolean;
  errors?: string[];
  message: string;
}
