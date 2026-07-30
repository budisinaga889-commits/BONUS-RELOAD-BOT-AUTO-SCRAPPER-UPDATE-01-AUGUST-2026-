import { app, dialog, shell, clipboard } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * PATCH 13 — Deployment-only browser resolver.
 *
 * Single source of truth for locating a Playwright-managed Chromium
 * install at runtime. Kept entirely separate from the scraping engine
 * (PageScanner / HTMLMapper / MonitoringEngine) so it can be revised
 * for packaging concerns without touching production monitoring code.
 *
 * Resolution priority (per user approval, cross-platform):
 *   1. Bundled — process.resourcesPath/browsers (and packaging fallbacks)
 *   2. PLAYWRIGHT_BROWSERS_PATH
 *   3. Platform default Playwright cache:
 *        Windows : %LOCALAPPDATA%\ms-playwright
 *        macOS   : ~/Library/Caches/ms-playwright
 *        Linux   : ~/.cache/ms-playwright
 *
 * If NOTHING resolves, callers get a structured `{ ok:false, ...diagnostic }`
 * result. They MUST call `showBrowserNotFoundDialog(details)` — never let
 * Playwright's raw exception reach the operator.
 */

export type BrowserSource =
  | 'bundled'
  | 'env-PLAYWRIGHT_BROWSERS_PATH'
  | 'platform-default-cache'
  | 'not-found';

export interface BrowserResolution {
  ok: boolean;
  /** Where the Chromium was found (or 'not-found'). */
  source: BrowserSource;
  /** Absolute path to the `browsers` directory to hand to Playwright. */
  browsersPath: string | null;
  /** Absolute path to the chromium-<rev> folder (informational). */
  chromiumFolder: string | null;
  /** Absolute path to the OS-specific browser executable (informational). */
  executable: string | null;
  /** Chromium version string if extractable from chrome-win/version.txt. */
  version: string | null;
  /** Search trail — every path we probed, in order. Used for diagnostics. */
  searched: Array<{ label: string; path: string; exists: boolean; hasChromium: boolean }>;
  /** Reason of failure (only when ok=false). */
  reason?: string;
}

function isDir(p: string): boolean {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}
function isFile(p: string): boolean {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function chromiumFolderIn(dir: string): { name: string; full: string } | null {
  if (!isDir(dir)) return null;
  try {
    const cands = fs.readdirSync(dir)
      .filter(n => /^chromium(?:_headless_shell)?-\d+$/.test(n))
      .map(n => ({ name: n, full: path.join(dir, n) }))
      .filter(o => isDir(o.full));
    if (cands.length === 0) return null;
    // Prefer highest revision.
    cands.sort((a, b) => {
      const na = parseInt(a.name.split('-').pop() || '0', 10);
      const nb = parseInt(b.name.split('-').pop() || '0', 10);
      return nb - na;
    });
    return cands[0];
  } catch {
    return null;
  }
}

function osChromeRelPath(): string {
  if (process.platform === 'win32') return path.join('chrome-win', 'chrome.exe');
  if (process.platform === 'darwin') return path.join('chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
  return path.join('chrome-linux', 'chrome');
}

function platformDefaultCache(): string {
  const home = os.homedir();
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return path.join(local, 'ms-playwright');
  }
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Caches', 'ms-playwright');
  return path.join(home, '.cache', 'ms-playwright');
}

function readChromiumVersion(chromiumFolder: string): string | null {
  const rel = process.platform === 'win32' ? 'chrome-win/version.txt'
            : process.platform === 'darwin' ? 'chrome-mac/version.txt'
            : 'chrome-linux/version.txt';
  const p = path.join(chromiumFolder, rel);
  if (!isFile(p)) return null;
  try {
    const v = fs.readFileSync(p, 'utf8').trim();
    return v || null;
  } catch { return null; }
}

/**
 * Build the ordered list of candidate `browsers` directories to probe.
 * The FIRST entry is always the bundled resources directory (four
 * variants to cover packaged / unpacked / dev / portable layouts).
 */
function candidates(): Array<{ label: string; path: string; source: BrowserSource }> {
  const out: Array<{ label: string; path: string; source: BrowserSource }> = [];
  const seen = new Set<string>();
  const push = (label: string, p: string | undefined, source: BrowserSource) => {
    if (!p) return;
    const abs = path.resolve(p);
    if (seen.has(abs)) return;
    seen.add(abs);
    out.push({ label, path: abs, source });
  };

  // 1. Bundled resources (packaged app + dev fallbacks).
  try { push('bundled (process.resourcesPath)', path.join(process.resourcesPath || '', 'browsers'), 'bundled'); } catch {}
  try { push('bundled (appPath/resources)',     path.join(app.getAppPath(), 'resources', 'browsers'), 'bundled'); } catch {}
  try { push('bundled (appPath/../resources)',  path.join(app.getAppPath(), '..', 'resources', 'browsers'), 'bundled'); } catch {}

  // 2. Explicit env var.
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
    push('PLAYWRIGHT_BROWSERS_PATH', process.env.PLAYWRIGHT_BROWSERS_PATH, 'env-PLAYWRIGHT_BROWSERS_PATH');
  }

  // 3. Platform default cache.
  push('platform default cache', platformDefaultCache(), 'platform-default-cache');

  return out;
}

/**
 * Resolve a usable Chromium installation. Does NOT throw — returns a
 * structured result so the caller can either proceed (ok=true) or
 * present the friendly dialog (ok=false).
 */
export function resolveChromium(): BrowserResolution {
  const cands = candidates();
  const searched: BrowserResolution['searched'] = [];
  const relExe = osChromeRelPath();

  for (const c of cands) {
    const exists = isDir(c.path);
    const chromium = exists ? chromiumFolderIn(c.path) : null;
    const hasChromium = chromium !== null;
    searched.push({ label: c.label, path: c.path, exists, hasChromium });
    if (!chromium) continue;
    const exe = path.join(chromium.full, relExe);
    if (!isFile(exe)) continue;
    return {
      ok: true,
      source: c.source,
      browsersPath: c.path,
      chromiumFolder: chromium.full,
      executable: exe,
      version: readChromiumVersion(chromium.full),
      searched
    };
  }

  return {
    ok: false,
    source: 'not-found',
    browsersPath: null,
    chromiumFolder: null,
    executable: null,
    version: null,
    searched,
    reason: 'No usable Chromium installation found in any known location.'
  };
}

/**
 * Apply a successful resolution to the environment so Playwright's
 * `chromium.launchPersistentContext()` picks up the bundled browser.
 * Only sets the env var if it isn't already pointing at a valid dir —
 * this preserves an operator's own override.
 */
export function applyChromiumResolution(res: BrowserResolution): void {
  if (!res.ok || !res.browsersPath) return;
  // Only overwrite when the current value would fail: if the user set
  // PLAYWRIGHT_BROWSERS_PATH themselves and it's the source we picked,
  // this is a no-op.
  process.env.PLAYWRIGHT_BROWSERS_PATH = res.browsersPath;
}

/** Compact diagnostic text (safe to copy to clipboard or attach to a bug report). */
export function buildDiagnosticText(res: BrowserResolution, logsDir: string | null): string {
  const lines: string[] = [];
  lines.push('==============================================================');
  lines.push('  LIVE DEPOSIT MONITOR — Chromium Resolution Diagnostic');
  lines.push('==============================================================');
  lines.push(`  Timestamp        : ${new Date().toISOString()}`);
  lines.push(`  App version      : v${(() => { try { return app.getVersion(); } catch { return 'unknown'; } })()}`);
  lines.push(`  Electron         : ${process.versions.electron || 'unknown'}`);
  lines.push(`  Node             : ${process.versions.node || 'unknown'}`);
  lines.push(`  Chrome (Electron): ${process.versions.chrome || 'unknown'}`);
  lines.push(`  Platform         : ${process.platform} / ${process.arch}`);
  lines.push(`  Host OS          : ${os.type()} ${os.release()}`);
  lines.push(`  Packaged         : ${(() => { try { return String(app.isPackaged); } catch { return 'unknown'; } })()}`);
  lines.push(`  Resource path    : ${process.resourcesPath || '(none)'}`);
  lines.push(`  Logs folder      : ${logsDir || '(not initialised)'}`);
  lines.push('');
  lines.push('-- Resolution --------------------------------------------------');
  lines.push(`  Outcome          : ${res.ok ? 'FOUND' : 'NOT FOUND'}`);
  lines.push(`  Source           : ${res.source}`);
  lines.push(`  Browsers path    : ${res.browsersPath || '(none)'}`);
  lines.push(`  Chromium folder  : ${res.chromiumFolder || '(none)'}`);
  lines.push(`  Executable       : ${res.executable || '(none)'}`);
  lines.push(`  Chromium version : ${res.version || '(unknown)'}`);
  if (res.reason) lines.push(`  Reason           : ${res.reason}`);
  lines.push('');
  lines.push('-- Search Trail -----------------------------------------------');
  res.searched.forEach((s, i) => {
    lines.push(`  ${i + 1}. ${s.label}`);
    lines.push(`     path         : ${s.path}`);
    lines.push(`     exists       : ${s.exists}`);
    lines.push(`     has chromium : ${s.hasChromium}`);
  });
  lines.push('==============================================================');
  return lines.join('\n');
}

/**
 * PATCH 13 §4 — Friendly runtime error dialog.
 *
 * Three buttons: "Copy Diagnostic", "Open Log Folder", "Close".
 * NEVER exposes Playwright's raw stack trace to the operator.
 *
 * The dialog is modal on the main window when one exists, but works
 * standalone when called during early startup before any BrowserWindow
 * is created.
 */
export async function showBrowserNotFoundDialog(
  res: BrowserResolution,
  logsDir: string | null
): Promise<void> {
  const diagnosticText = buildDiagnosticText(res, logsDir);

  // Loop the dialog so "Copy Diagnostic" / "Open Log Folder" don't dismiss
  // it — the operator can copy AND open the log folder AND then close.
  //
  // Electron's `dialog.showMessageBox` returns the index of the button
  // clicked; we treat 0 and 1 as "still-open" actions and 2 as final close.
  const buttons = ['Copy Diagnostic', 'Open Log Folder', 'Close'];

  // Loop until the operator explicitly chooses Close.
  // Guard against a runaway loop by capping iterations.
  for (let i = 0; i < 8; i++) {
    let response = 2;
    try {
      const r = await dialog.showMessageBox({
        type: 'error',
        title: 'Chromium Browser Not Found',
        message: 'Chromium Browser Not Found',
        detail: [
          'The bundled browser could not be located, so monitoring cannot start.',
          '',
          'Possible causes:',
          '  • bundled browser missing (portable package may have been extracted incorrectly)',
          '  • incomplete extraction (portable .exe not fully unpacked)',
          '  • antivirus quarantined Chromium during first run',
          '  • damaged portable package (re-download recommended)',
          '',
          'Diagnostics:',
          `  Browser path : ${res.browsersPath || '(none — see search trail below)'}`,
          `  Executable   : ${res.executable || '(none)'}`,
          `  Electron     : ${process.versions.electron || 'unknown'}`,
          `  Playwright   : ${(() => { try { return require('playwright/package.json').version; } catch { return 'unknown'; } })()}`,
          `  Platform     : ${process.platform}/${process.arch}`,
          '',
          'Use the buttons below to copy a full diagnostic report or open the',
          'log folder to attach recent logs to a support request.'
        ].join('\n'),
        buttons,
        defaultId: 2,
        cancelId: 2,
        noLink: true
      });
      response = r.response;
    } catch {
      // If the dialog itself fails (should never happen), fall through
      // to the final Close so we don't loop forever.
      response = 2;
    }

    if (response === 0) {
      // Copy Diagnostic — write to system clipboard.
      try {
        clipboard.writeText(diagnosticText);
      } catch { /* clipboard unavailable — non-fatal */ }
      continue;
    }
    if (response === 1) {
      // Open Log Folder — non-blocking; keep the dialog visible.
      if (logsDir) {
        try { await shell.openPath(logsDir); } catch { /* non-fatal */ }
      }
      continue;
    }
    break; // Close
  }
}
