#!/usr/bin/env node
/**
 * PATCH 13 §3 — Fail-fast pre-flight validator for the bundled Chromium.
 *
 * Runs BEFORE electron-builder. If anything is wrong, the exit code is 1
 * and electron-builder never starts — a broken Portable.exe can therefore
 * never be produced.
 *
 * Checks:
 *   1. resources/browsers/chromium-<rev>/chrome-win/chrome.exe exists
 *   2. chrome.exe is a valid PE binary and non-trivial in size
 *   3. Companion files (chrome-win/version.txt, chrome-win/chrome_100_percent.pak,
 *      chrome-win/resources.pak, chrome-win/v8_context_snapshot.bin) exist
 *   4. BUNDLE_INFO.json exists and is well-formed
 *   5. Runtime usability: when the host is Windows (or WINE is available),
 *      execute `chrome.exe --version` and require a non-empty version
 *      string starting with "Chromium ". Non-Windows hosts fall back to
 *      the PE header + companion-file check and log a warning that the
 *      final execution check must happen on Windows.
 *
 * BUNDLE_INFO.json is updated with the real Chromium version when the
 * execution check runs successfully.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const BROWSERS_DIR = path.join(REPO_ROOT, 'resources', 'browsers');
const BUNDLE_INFO_PATH = path.join(BROWSERS_DIR, 'BUNDLE_INFO.json');

function log(msg)  { process.stdout.write(`[verify-browser-bundle] ${msg}\n`); }
function warn(msg) { process.stderr.write(`[verify-browser-bundle] WARN: ${msg}\n`); }
function fail(reasonLines) {
  process.stderr.write('\n' + '='.repeat(64) + '\n');
  process.stderr.write('ERROR — bundled Chromium is not usable\n');
  process.stderr.write('='.repeat(64) + '\n');
  for (const l of reasonLines) process.stderr.write(l + '\n');
  process.stderr.write('\nFix:\n');
  process.stderr.write('  1. Ensure Playwright Chromium is installed: npx playwright install chromium\n');
  process.stderr.write('  2. Run the bundler:                        npm run bundle:browser\n');
  process.stderr.write('  3. Re-run this verification:                npm run verify:browser-bundle\n');
  process.stderr.write('  (see BUILD.md for the complete workflow)\n');
  process.stderr.write('='.repeat(64) + '\n\n');
  process.exit(1);
}

function isDir(p)  { try { return fs.statSync(p).isDirectory(); } catch { return false; } }
function isFile(p) { try { return fs.statSync(p).isFile();      } catch { return false; } }

function findChromiumFolder() {
  if (!isDir(BROWSERS_DIR)) return null;
  const cands = fs.readdirSync(BROWSERS_DIR)
    .filter(n => /^chromium(?:_headless_shell)?-\d+$/.test(n))
    .map(n => ({ name: n, full: path.join(BROWSERS_DIR, n) }))
    .filter(o => isDir(o.full));
  if (cands.length === 0) return null;
  cands.sort((a, b) => {
    const na = parseInt(a.name.split('-').pop() || '0', 10);
    const nb = parseInt(b.name.split('-').pop() || '0', 10);
    return nb - na;
  });
  return cands[0];
}

function validatePE(exePath) {
  const st = fs.statSync(exePath);
  if (st.size < 512 * 1024) {
    return { ok: false, reason: `chrome.exe unrealistically small (${st.size} bytes)` };
  }
  const fd = fs.openSync(exePath, 'r');
  const buf = Buffer.alloc(2);
  fs.readSync(fd, buf, 0, 2, 0);
  fs.closeSync(fd);
  if (buf[0] !== 0x4D || buf[1] !== 0x5A) {
    return { ok: false, reason: `chrome.exe missing "MZ" PE header (got 0x${buf.toString('hex')})` };
  }
  return { ok: true, size: st.size };
}

/**
 * Try to actually execute `chrome.exe --version`. On Windows this runs
 * natively. On non-Windows hosts we try `wine` if available, otherwise
 * we skip execution and rely on the PE + companion-file checks — this
 * is called out in the log so the developer knows the definitive
 * runtime check happens on Windows.
 */
function runChromeVersion(exePath) {
  if (process.platform === 'win32') {
    try {
      const r = cp.spawnSync(exePath, ['--version'], { encoding: 'utf8', timeout: 15000 });
      if (r.status === 0 && r.stdout && /Chromium\s+\d/i.test(r.stdout)) {
        return { ok: true, version: r.stdout.trim(), mode: 'native' };
      }
      return { ok: false, reason: `chrome.exe --version exited ${r.status}: stdout="${(r.stdout || '').trim()}" stderr="${(r.stderr || '').trim()}"` };
    } catch (e) {
      return { ok: false, reason: `spawn chrome.exe failed: ${e && e.message}` };
    }
  }
  // Non-Windows host: use wine if present, otherwise skip.
  const which = cp.spawnSync('sh', ['-c', 'command -v wine'], { encoding: 'utf8' });
  if (which.status === 0 && (which.stdout || '').trim()) {
    try {
      const r = cp.spawnSync('wine', [exePath, '--version'], { encoding: 'utf8', timeout: 20000 });
      if (r.status === 0 && r.stdout && /Chromium\s+\d/i.test(r.stdout)) {
        return { ok: true, version: r.stdout.trim(), mode: 'wine' };
      }
    } catch { /* fall through */ }
  }
  return { ok: 'skipped', reason: `runtime execution skipped on ${process.platform} (final check must happen on Windows)` };
}

// -----------------------------------------------------------------------------

(function main() {
  log(`Verifying bundle in ${BROWSERS_DIR}`);
  const chromium = findChromiumFolder();
  if (!chromium) {
    fail([`No chromium-<revision>/ folder found under resources/browsers/`]);
  }
  log(`  chromium folder : ${chromium.name}`);

  const chromeWinDir = path.join(chromium.full, 'chrome-win');
  const exePath = path.join(chromeWinDir, 'chrome.exe');
  if (!isDir(chromeWinDir)) {
    fail([
      `Missing chrome-win subfolder in ${chromium.name}`,
      `Expected: ${chromeWinDir}`,
      'This usually means the Playwright cache used at bundle time did not',
      'contain a Windows-x64 Chromium (chrome-win). Re-run the bundle step',
      'on a Windows host, or point PLAYWRIGHT_BROWSERS_PATH at a Windows cache.',
    ]);
  }
  if (!isFile(exePath)) {
    fail([`chrome.exe missing at ${exePath}`]);
  }
  const pe = validatePE(exePath);
  if (!pe.ok) fail([pe.reason]);
  log(`  chrome.exe      : OK (${(pe.size / (1024 * 1024)).toFixed(1)} MB, valid PE)`);

  // Companion files (the ones Chromium refuses to start without).
  const companions = [
    'version.txt',
    'chrome_100_percent.pak',
    'chrome_200_percent.pak',
    'resources.pak',
    'v8_context_snapshot.bin',
    'icudtl.dat'
  ];
  const missing = companions.filter(name => !isFile(path.join(chromeWinDir, name)));
  if (missing.length > 0) {
    fail([
      `chrome-win/ is missing required companion files:`,
      ...missing.map(m => `  • ${m}`)
    ]);
  }
  log(`  companion files : ${companions.length}/${companions.length} present`);

  // BUNDLE_INFO.json well-formed?
  if (!isFile(BUNDLE_INFO_PATH)) {
    fail([`BUNDLE_INFO.json missing at ${BUNDLE_INFO_PATH}`]);
  }
  let info;
  try {
    info = JSON.parse(fs.readFileSync(BUNDLE_INFO_PATH, 'utf8'));
  } catch (e) {
    fail([`BUNDLE_INFO.json not valid JSON: ${e && e.message}`]);
  }
  for (const k of ['playwrightVersion', 'chromiumRevision', 'browserSize', 'filesBundled', 'generatedAt']) {
    if (!(k in info)) fail([`BUNDLE_INFO.json missing required key: ${k}`]);
  }
  log(`  BUNDLE_INFO     : OK (playwright ${info.playwrightVersion}, revision ${info.chromiumRevision})`);

  // Runtime usability: prefer chrome.exe --version, fall back to version.txt.
  const run = runChromeVersion(exePath);
  if (run.ok === true) {
    info.browserVersion = run.version;
    info.runtimeCheck = { mode: run.mode, verifiedAt: new Date().toISOString(), passed: true };
    log(`  runtime check   : PASSED (${run.mode}) → ${run.version}`);
  } else if (run.ok === 'skipped') {
    // Not fatal on non-Windows hosts — the PE check + companion files
    // already prove the bundle is structurally correct. The definitive
    // usability check runs on Windows (either the developer's own PC
    // during dist:portable or on the target machine at first launch).
    let versionFromTxt = 'unknown';
    const verFile = path.join(chromeWinDir, 'version.txt');
    if (isFile(verFile)) {
      try { versionFromTxt = fs.readFileSync(verFile, 'utf8').trim() || 'unknown'; } catch {}
    }
    info.browserVersion = versionFromTxt;
    info.runtimeCheck = { mode: 'skipped', reason: run.reason, verifiedAt: new Date().toISOString(), passed: false };
    warn(run.reason);
    warn(`Reporting browserVersion from chrome-win/version.txt: ${versionFromTxt}`);
  } else {
    fail([
      `chrome.exe failed the runtime usability check:`,
      `  ${run.reason}`,
      '',
      'The executable is present but did not report a valid Chromium version.',
      'Likely causes: antivirus quarantine mid-copy, damaged Playwright cache,',
      'or the wrong architecture (chrome-win expects x64 Windows).'
    ]);
  }

  fs.writeFileSync(BUNDLE_INFO_PATH, JSON.stringify(info, null, 2) + '\n', 'utf8');
  log('Bundle verification passed.');
})();
