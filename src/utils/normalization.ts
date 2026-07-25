/**
 * Transaction field normalization utilities
 */

export function normalizeUserName(userName: string): string {
  return userName.trim().replace(/\s+/g, ' ');
}

export function normalizeAccountNumber(accountNumber: string): string {
  return accountNumber.replace(/[\s\-]/g, '').replace(/[^0-9]/g, '');
}

export function normalizeAmount(amount: string | number): number {
  if (typeof amount === 'number') {
    return Math.round(amount);
  }
  
  const cleaned = amount.replace(/,/g, '');
  const numeric = parseFloat(cleaned);
  
  if (isNaN(numeric)) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  
  return Math.round(numeric);
}

export function normalizeProcessDate(processDate: string): string {
  return processDate.trim();
}
