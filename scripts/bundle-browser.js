#!/usr/bin/env node
/**
 * PATCH 13 — Automatic Chromium Packaging (deployment-only).
 *
 * Locates the Playwright-managed Chromium browser folder and copies it
 * into `resources/browsers/` so `electron-builder`'s `extraResources`
 * rule can then embed it into the Portable.exe. Nothing here touches
 * the scraping engine, monitoring engine, or any runtime code.
 *
 * Resolution priority (cross-platform, per user approval):
 *   1. PLAYWRIGHT_BROWSERS_PATH env var
 *   2. Platform default Playwright cache:
 *        Windows : %LOCALAPPDATA%\ms-playwright
 *        macOS   : ~/Library/Caches/ms-playwright
 *        Linux   : ~/.cache/ms-playwright
 *
 * Only the `chromium-<revision>/` folder is copied — never Firefox,
 * WebKit, ffmpeg, or the whole Playwright cache. This keeps the
 * portable package as small as possible.
 *
 * The script is idempotent: if `resources/browsers/chromium-*` already
 * contains a usable Chromium install, it does nothing and exits 0.
 *
 * Exit codes:
 *   0 — success (or no-op because already staged)
 *   1 — fail-fast, Chromium could not be located / copied / validated
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '..');
const RESOURCES_DIR = path.join(REPO_ROOT, 'resources');
const BROWSERS_DIR = path.join(RESOURCES_DIR, 'browsers');
const BUNDLE_INFO_PATH = path.join(BROWSERS_DIR, 'BUNDLE_INFO.json');
// Windows portable target requires `chrome-win/chrome.exe` inside the
// chromium-<rev>/ folder. Playwright names the OS-specific subfolder:
//   Windows : chrome-win/chrome.exe
//   Linux   : chrome-linux/chrome
//   macOS   : chrome-mac/Chromium.app/Contents/MacOS/Chromium
// The portable build target is Windows-x64, so we insist on chrome-win.
// A developer building on Linux/macOS must set PLAYWRIGHT_BROWSERS_PATH
// to a directory that contains the Windows Chromium (see BUILD.md).
const WINDOWS_CHROME_REL = path.join('chrome-win', 'chrome.exe');

function log(msg)  { process.stdout.write(`[bundle-browser] ${msg}\n`); }
function warn(msg) { process.stderr.write(`[bundle-browser] WARN: ${msg}\n`); }
function fail(msg) {
  process.stderr.write('\n' + '='.repeat(64) + '\n');
  process.stderr.write('ERROR — bundle-browser cannot continue\n');
  process.stderr.write('='.repeat(64) + '\n');
  process.stderr.write(msg + '\n');
  process.stderr.write('='.repeat(64) + '\n\n');
  process.exit(1);
}

function getPlatformDefaultCache() {
  const home = os.homedir();
  const plat = process.platform;
  if (plat === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return path.join(local, 'ms-playwright');
  }
  if (plat === 'darwin') {
    return path.join(home, 'Library', 'Caches', 'ms-playwright');
  }
  // Linux / *BSD / everything else
  return path.join(home, '.cache', 'ms-playwright');
}

function candidateCaches() {
  const out = [];
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
    out.push({ label: 'PLAYWRIGHT_BROWSERS_PATH', dir: process.env.PLAYWRIGHT_BROWSERS_PATH });
  }
  out.push({ label: 'platform default cache', dir: getPlatformDefaultCache() });
  return out;
}

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}
function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

/** List every `chromium-<revision>` subfolder in `cacheDir`. Returns [] if none. */
function findChromiumFoldersIn(cacheDir) {
  if (!isDir(cacheDir)) return [];
  return fs.readdirSync(cacheDir)
    .filter(name => /^chromium(?:_headless_shell)?-\d+$/.test(name))
    .map(name => ({ name, full: path.join(cacheDir, name) }))
    .filter(o => isDir(o.full))
    // Newest revision first (numeric sort on the trailing number).
    .sort((a, b) => {
      const na = parseInt(a.name.split('-').pop() || '0', 10);
      const nb = parseInt(b.name.split('-').pop() || '0', 10);
      return nb - na;
    });
}

/** Recursively count files and total byte size of `dir`. */
function measureTree(dir) {
  let files = 0;
  let bytes = 0;
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const st = fs.lstatSync(p);
      if (st.isDirectory()) walk(p);
      else if (st.isFile()) { files++; bytes += st.size; }
    }
  };
  walk(dir);
  return { files, bytes };
}

/** Deep copy `src` → `dst`, preserving directory structure. Overwrites. */
function copyDir(src, dst) {
  if (!isDir(dst)) fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    const st = fs.lstatSync(s);
    if (st.isDirectory()) copyDir(s, d);
    else if (st.isFile()) fs.copyFileSync(s, d);
    // Silently skip symlinks / sockets — Chromium tree has none.
  }
}

/** Human-readable byte size (MB, one decimal). */
function mb(bytes) { return (bytes / (1024 * 1024)).toFixed(1) + ' MB'; }

/** Read the Playwright package.json version safely. */
function detectPlaywrightVersion() {
  try {
    const pkgPath = path.join(REPO_ROOT, 'node_modules', 'playwright', 'package.json');
    if (isFile(pkgPath)) return require(pkgPath).version || 'unknown';
  } catch {}
  return 'unknown';
}

/**
 * PATCH 13 §3 — stronger build validation. Verify the copied
 * chrome.exe is present, non-trivial in size, and a valid PE
 * executable (checks the leading "MZ" DOS header). Executing the
 * binary itself is not portable across build hosts (a developer on
 * Linux/macOS cannot run a Windows chrome.exe), so we combine the
 * cheap-but-strong PE header sanity check here with a stricter
 * runtime validation (chrome --version) inside
 * `verify-browser-bundle.js` when the current host is Windows.
 */
function validateChromeBinary(exePath) {
  if (!isFile(exePath)) {
    return { ok: false, reason: `chrome.exe missing at ${exePath}` };
  }
  const st = fs.statSync(exePath);
  // Windows chrome.exe is typically > 2 MB; anything under 512 KB is
  // definitely wrong (probably a stub / interrupted copy).
  if (st.size < 512 * 1024) {
    return { ok: false, reason: `chrome.exe unrealistically small (${st.size} bytes) — probable corrupt or partial file` };
  }
  // PE header check: first 2 bytes of a Windows executable must be "MZ".
  try {
    const fd = fs.openSync(exePath, 'r');
    const buf = Buffer.alloc(2);
    fs.readSync(fd, buf, 0, 2, 0);
    fs.closeSync(fd);
    if (buf[0] !== 0x4D || buf[1] !== 0x5A) {
      return { ok: false, reason: `chrome.exe has invalid PE header (expected "MZ", got 0x${buf.toString('hex')})` };
    }
  } catch (e) {
    return { ok: false, reason: `could not read chrome.exe header: ${e && e.message}` };
  }
  return { ok: true, size: st.size };
}

/** True when `dir/chromium-<rev>/chrome-win/chrome.exe` exists and is valid. */
function browsersDirAlreadyValid(dir) {
  const found = findChromiumFoldersIn(dir);
  if (found.length === 0) return null;
  for (const f of found) {
    const exe = path.join(f.full, WINDOWS_CHROME_REL);
    const v = validateChromeBinary(exe);
    if (v.ok) return { chromium: f, exe, size: v.size };
  }
  return null;
}

// -----------------------------------------------------------------------------

(function main() {
  log(`Repo root       : ${REPO_ROOT}`);
  log(`Target dir      : ${BROWSERS_DIR}`);
  log(`Host platform   : ${process.platform} / ${process.arch}`);

  // 0. Already bundled?  →  no-op (idempotent).
  const already = browsersDirAlreadyValid(BROWSERS_DIR);
  if (already) {
    log(`Chromium already staged: ${already.chromium.name} (${mb(already.size)}) — skipping copy.`);
    // Re-emit BUNDLE_INFO even for the idempotent case so timestamps stay fresh.
    emitBundleInfo(already.chromium, already.exe);
    return;
  }

  // 1. Locate a source cache that has Chromium.
  const caches = candidateCaches();
  log('Looking for Playwright Chromium in:');
  for (const c of caches) log(`  • ${c.label}: ${c.dir}`);

  let picked = null;
  for (const c of caches) {
    const list = findChromiumFoldersIn(c.dir);
    if (list.length === 0) continue;
    // Pick the newest chromium-<rev> that contains chrome-win/chrome.exe.
    for (const cand of list) {
      const exe = path.join(cand.full, WINDOWS_CHROME_REL);
      const v = validateChromeBinary(exe);
      if (v.ok) { picked = { source: c, chromium: cand, exePath: exe, size: v.size }; break; }
      warn(`Skipping ${cand.name}: ${v.reason}`);
    }
    if (picked) break;
  }

  if (!picked) {
    fail([
      'Bundled Chromium not found.',
      '',
      'A Windows-x64 Chromium build (chrome-win/chrome.exe) was not present in',
      'any of the following locations:',
      ...caches.map(c => `  • ${c.label}: ${c.dir}`),
      '',
      'Fix:',
      '  1. Install Playwright Chromium locally:',
      '       npx playwright install chromium',
      '  2. If you are building on macOS or Linux for a Windows Portable target,',
      '     set PLAYWRIGHT_BROWSERS_PATH to a Windows Playwright cache that',
      '     contains chromium-<rev>/chrome-win/chrome.exe. See BUILD.md.',
      '  3. Re-run: npm run bundle:browser',
      ''
    ].join('\n'));
  }

  // 2. Copy chromium-<rev>/ into resources/browsers/.
  if (!isDir(RESOURCES_DIR)) fs.mkdirSync(RESOURCES_DIR, { recursive: true });
  // Clear any old chromium-* leftovers so we never ship stale binaries.
  if (isDir(BROWSERS_DIR)) {
    for (const name of fs.readdirSync(BROWSERS_DIR)) {
      if (/^chromium(?:_headless_shell)?-\d+$/.test(name)) {
        fs.rmSync(path.join(BROWSERS_DIR, name), { recursive: true, force: true });
      }
    }
  } else {
    fs.mkdirSync(BROWSERS_DIR, { recursive: true });
  }

  const dstChromium = path.join(BROWSERS_DIR, picked.chromium.name);
  log(`Copying ${picked.chromium.name} from "${picked.source.label}" into resources/browsers/ ...`);
  copyDir(picked.chromium.full, dstChromium);

  // 3. Validate the copied binary.
  const dstExe = path.join(dstChromium, WINDOWS_CHROME_REL);
  const validation = validateChromeBinary(dstExe);
  if (!validation.ok) {
    fail(`Post-copy validation failed for ${dstExe}: ${validation.reason}`);
  }

  emitBundleInfo(picked.chromium, dstExe);

  const measured = measureTree(dstChromium);
  log(`✓ Chromium bundled: ${picked.chromium.name} (${mb(measured.bytes)}, ${measured.files} files)`);
  log(`  chrome.exe      : ${dstExe}`);
  log('Done.');
})();

function emitBundleInfo(chromiumFolder, exePath) {
  const playwrightVersion = detectPlaywrightVersion();
  const chromiumRevision = String(chromiumFolder.name.split('-').pop() || 'unknown');
  const measured = (function () {
    try { return measureTree(chromiumFolder.full); } catch { return { files: 0, bytes: 0 }; }
  })();
  // Best-effort browser version detection. The exe is Windows-only so we
  // cannot exec it from a Linux/macOS host; verify-browser-bundle.js will
  // run `chrome.exe --version` on Windows and update this field there.
  let browserVersion = 'unknown';
  const verFile = path.join(chromiumFolder.full, 'chrome-win', 'version.txt');
  if (isFile(verFile)) {
    try { browserVersion = fs.readFileSync(verFile, 'utf8').trim() || 'unknown'; } catch {}
  }
  const info = {
    playwrightVersion,
    chromiumRevision,
    browserVersion,
    platform: process.platform,
    architecture: process.arch,
    generatedAt: new Date().toISOString(),
    browserSize: measured.bytes,
    browserSizeHuman: (measured.bytes / (1024 * 1024)).toFixed(1) + ' MB',
    filesBundled: measured.files,
    executable: path.relative(REPO_ROOT, exePath).replace(/\\/g, '/'),
    hostPlatformAtBundle: `${os.platform()}-${os.arch()}-${os.release()}`
  };
  fs.mkdirSync(path.dirname(BUNDLE_INFO_PATH), { recursive: true });
  fs.writeFileSync(BUNDLE_INFO_PATH, JSON.stringify(info, null, 2) + '\n', 'utf8');
  log(`Wrote ${path.relative(REPO_ROOT, BUNDLE_INFO_PATH)}`);
}
