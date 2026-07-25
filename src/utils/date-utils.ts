/**
 * Date utility functions
 */

export function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return date1.toDateString() === date2.toDateString();
}

export function getStartOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

export function getEndOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

/**
 * Format today's local system date for the deposit panel's date input.
 * Panel uses ISO calendar-date format: YYYY-MM-DD.
 * Callers must always pass a Date; caller should use `new Date()` to get "now"
 * so that after-midnight cycles automatically pick up the new day.
 */
export function formatPanelDate(date: Date): string {
  return formatDate(date);
}

/**
 * Extract the current page number from a URL's query string.
 * Supports two conventional forms:
 *   • ?page=3  (Yii2/Laravel default, Rails "page" kaminari)
 *   • /page/3  (some CMS routing)
 * Falls back to 1 when no page marker is present.
 */
export function extractPageNumber(url: string): number {
  try {
    const u = new URL(url);
    const q = u.searchParams.get('page');
    if (q && /^\d+$/.test(q)) return parseInt(q, 10);
    const m = u.pathname.match(/\/page\/(\d+)(?:\/|$)/);
    if (m) return parseInt(m[1], 10);
    return 1;
  } catch {
    return 1;
  }
}

/**
 * Returns true when the URL exposes a page marker (either `?page=N` in the
 * query string or `/page/N` in the pathname). When false, `extractPageNumber`
 * has fallen back to its default `1` and must NOT be treated as reliable —
 * the DOM widget's `.active` marker is the source of truth in that case.
 */
export function urlHasPageMarker(url: string): boolean {
  try {
    const u = new URL(url);
    const q = u.searchParams.get('page');
    if (q && /^\d+$/.test(q)) return true;
    return /\/page\/\d+(?:\/|$)/.test(u.pathname);
  } catch {
    return false;
  }
}
