/**
 * Raw transaction parsed from HTML (before validation).
 *
 * `createdAt` is the panel's Created Date/Time — the field the browser
 * uses for row ordering. `processDate` is the completion timestamp and
 * may be non-monotonic across sibling rows; it must never be used for
 * scanning decisions.
 */
export interface RawTransaction {
  userName: string;
  bank: string;
  accountName: string;
  accountNumber: string;
  amount: number;
  status: string;
  done: string;
  depositType: string;
  agent: string;
  processDate: string;
  createdAt: string;
}

/**
 * Validated transaction (after validation + fingerprint generation)
 */
export interface Transaction extends RawTransaction {
  transactionFingerprint: string;
  filterProfile: string;
  exportStatus: 'pending' | 'exported' | 'failed';
}

/**
 * Export row for Google Sheets
 */
export interface ExportRow {
  userId: string;
  amount: number;
  sheetData: string;
  processDate: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
