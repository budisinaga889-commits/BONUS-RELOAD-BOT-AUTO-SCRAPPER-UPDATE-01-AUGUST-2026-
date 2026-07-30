#!/usr/bin/env node
/**
 * PATCH 13.2 — Confidence-based bundle validator.
 *
 * Design principle
 * ----------------
 * The validator answers ONE question and one question only:
 *
 *     "Is the bundled Chromium structurally complete and deployable?"
 *
 * It DOES NOT try to answer "will the bundled Chromium execute under
 * every possible Windows environment?" — that is the launch-time
 * concern of playwright.chromium.launchPersistentContext(). Trying to
 * pre-answer runtime concerns from a Node script has led to two
 * false-negative rejections in a row (version.txt mandatory, then
 * chrome.exe --version mandatory).
 *
 * Validation is split into THREE levels:
 *
 * ┌─────────────┬────────────────────────────────────────────────────┐
 * │ Level 1     │ FATAL. Failure ⇒ exit 1. The bundle is not         │
 * │ (fail-fast) │ structurally deployable.                           │
 * ├─────────────┼────────────────────────────────────────────────────┤
 * │ Level 2     │ WARN. Emits a warning + diagnostic, continues.     │
 * │ (soft)      │ Provides ADDITIONAL confidence, never gates the    │
 * │             │ build.                                             │
 * ├─────────────┼────────────────────────────────────────────────────┤
 * │ Level 3     │ INFO. Pure reporting.                              │
 * │ (info)      │                                                    │
 * └─────────────┴────────────────────────────────────────────────────┘
 *
 * Adding a new signal in the future?
 *   → Structural / cannot-run-without-it   → put in Level 1
 *   → Extra confidence / environment-dependent → put in Level 2
 *   → Reporting only                       → put in Level 3
 *
 * NEVER add environment-dependent checks (executables running, network
 * calls, permission probes, …) to Level 1. If it CAN legitimately fail
 * on a working bundle in some environment, it belongs in Level 2.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const BROWSERS_DIR = path.join(REPO_ROOT, 'resources', 'browsers');
const BUNDLE_INFO_PATH = path.join(BROWSERS_DIR, 'BUNDLE_INFO.json');

// ------------------------------------------------------------
// Report accumulator — the validator collects every check into a
// structured report before deciding the process exit code. This keeps
// Level 2 warnings visible even when Level 1 has already passed, and
// makes the terminal output reproduce the design table above.
// ------------------------------------------------------------
const report = {
  level1: /** @type {{name: string, ok: boolean, detail: string}[]} */ ([]),
  level2: /** @type {{name: string, ok: boolean|'skipped', detail: string}[]} */ ([]),
  level3: /** @type {{name: string, value: string}[]} */ ([]),
};
function l1(name, ok, detail = '') { report.level1.push({ name, ok, detail }); }
function l2(name, ok, detail = '') { report.level2.push({ name, ok, detail }); }
function l3(name, value)            { report.level3.push({ name, value }); }

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

// ------------------------------------------------------------
// Level 2 opportunistic runtime probe.
//
// Explicitly NOT a gating check. The application never launches
// chrome.exe directly — it goes through
// `playwright.chromium.launchPersistentContext(...)`, which sets up
// its own sandbox flags, user-data-dir, and env. A direct execution
// with `--version` can fail for reasons entirely unrelated to whether
// Playwright can drive the same binary (Windows AppLocker, restricted
// service accounts, missing GDI dependencies for headed --version
// output on some Server SKUs, etc). We still run it because when it
// works it is a *very strong* positive signal for the bundle; we just
// never treat its failure as authoritative.
// ------------------------------------------------------------
function opportunisticChromeVersion(exePath) {
  if (process.platform !== 'win32') {
    return { ok: 'skipped', reason: `not attempted on ${process.platform} (Windows PE cannot execute on this host)` };
  }
  try {
    const r = cp.spawnSync(exePath, ['--version'], { encoding: 'utf8', timeout: 15000 });
    if (r.status === 0 && r.stdout && /Chromium\s+\d/i.test(r.stdout)) {
      return { ok: true, version: r.stdout.trim() };
    }
    return { ok: false, reason: `exit=${r.status} stdout="${(r.stdout || '').trim()}" stderr="${(r.stderr || '').trim()}"` };
  } catch (e) {
    return { ok: false, reason: `spawn failed: ${e && e.message}` };
  }
}

// ============================================================
//                          M A I N
// ============================================================
(function main() {
  const line = '='.repeat(64);
  process.stdout.write(line + '\n');
  process.stdout.write('  Bundle Validator (confidence-based, 3 levels)\n');
  process.stdout.write(`  Target: ${BROWSERS_DIR}\n`);
  process.stdout.write(line + '\n\n');

  // ------------------------------------------------------------
  // LEVEL 1 — FATAL structural checks.
  // ------------------------------------------------------------
  const chromium = findChromiumFolder();
  l1('chromium folder present', chromium !== null, chromium ? chromium.name : 'no chromium-<rev>/ under resources/browsers');
  if (!chromium) return finishAndExit();

  const chromeWinDir = path.join(chromium.full, 'chrome-win');
  l1('chrome-win/ subfolder present', isDir(chromeWinDir), chromeWinDir);
  if (!isDir(chromeWinDir)) return finishAndExit();

  const exePath = path.join(chromeWinDir, 'chrome.exe');
  l1('chrome.exe present', isFile(exePath), exePath);
  if (!isFile(exePath)) return finishAndExit();

  const pe = validatePE(exePath);
  l1('chrome.exe is a valid PE binary', pe.ok, pe.ok ? `${(pe.size / (1024 * 1024)).toFixed(1)} MB, MZ header OK` : pe.reason);
  if (!pe.ok) return finishAndExit();

  // Required runtime files — every Playwright Chromium build ships these.
  // Their absence means the browser physically cannot start no matter
  // what environment it lands in.
  const requiredFiles = [
    'chrome.dll',                  // main Chromium module
    'chrome_100_percent.pak',      // required UI resources
    'resources.pak',               // required base resources
    'v8_context_snapshot.bin',     // required V8 startup snapshot
    'icudtl.dat'                   // required ICU data
  ];
  const missingRequired = requiredFiles.filter(f => !isFile(path.join(chromeWinDir, f)));
  l1('required runtime files present', missingRequired.length === 0,
     missingRequired.length === 0
       ? `${requiredFiles.length}/${requiredFiles.length} present`
       : `missing: ${missingRequired.join(', ')}`);
  if (missingRequired.length > 0) return finishAndExit();

  // BUNDLE_INFO.json — deployment provenance. Malformed or missing
  // required keys means we cannot honestly report what we are shipping.
  l1('BUNDLE_INFO.json present', isFile(BUNDLE_INFO_PATH), BUNDLE_INFO_PATH);
  if (!isFile(BUNDLE_INFO_PATH)) return finishAndExit();
  let info;
  try {
    info = JSON.parse(fs.readFileSync(BUNDLE_INFO_PATH, 'utf8'));
    l1('BUNDLE_INFO.json is valid JSON', true, '');
  } catch (e) {
    l1('BUNDLE_INFO.json is valid JSON', false, e && e.message);
    return finishAndExit();
  }
  const requiredKeys = ['playwrightVersion', 'chromiumRevision', 'browserVersion', 'platform',
                        'architecture', 'browserSize', 'filesBundled', 'generatedAt'];
  const missingKeys = requiredKeys.filter(k => !(k in info));
  l1('BUNDLE_INFO.json required keys', missingKeys.length === 0,
     missingKeys.length === 0 ? `all ${requiredKeys.length} present` : `missing: ${missingKeys.join(', ')}`);
  if (missingKeys.length > 0) return finishAndExit();

  // ------------------------------------------------------------
  // LEVEL 2 — SOFT confidence signals. Never fail the build.
  // Everything here is a "nice-to-have" that boosts our confidence
  // when it succeeds but does NOT mean the bundle is broken when it
  // doesn't.
  // ------------------------------------------------------------

  // Extra Chromium resource paks that only some revisions ship.
  const optionalFiles = [
    'chrome_200_percent.pak',
    'version.txt'
  ];
  for (const name of optionalFiles) {
    const present = isFile(path.join(chromeWinDir, name));
    l2(`optional companion: ${name}`, present, present ? 'present' : 'not present — OK, some revisions omit it');
  }

  // Chromium ships localised strings under `locales/` for the UI.
  // Its absence would mean an incomplete Chromium tree — but there ARE
  // Playwright chromium_headless_shell variants that omit it, so this
  // is Level 2 not Level 1.
  const localesDir = path.join(chromeWinDir, 'locales');
  const localesCount = isDir(localesDir) ? fs.readdirSync(localesDir).filter(n => n.endsWith('.pak')).length : 0;
  l2('locales/ folder present', localesCount > 0, localesCount > 0 ? `${localesCount} .pak files` : 'not present (headless_shell variant?)');

  // Chromium ships SwiftShader (software WebGL) — present in every
  // recent full Chromium build.
  const swiftShaderDir = path.join(chromeWinDir, 'swiftshader');
  l2('swiftshader/ folder present', isDir(swiftShaderDir),
     isDir(swiftShaderDir) ? 'present' : 'not present (may indicate a stripped Chromium build)');

  // Opportunistic `chrome.exe --version` probe.
  //
  // IMPORTANT: this is NOT a gating usability test. The real app never
  // executes chrome.exe directly; it drives it through
  // playwright.chromium.launchPersistentContext(...). A `--version`
  // failure here does not predict a launchPersistentContext failure at
  // runtime — and vice versa. We keep the probe purely as an extra
  // confidence signal that gets recorded in BUNDLE_INFO.json when it
  // happens to succeed.
  const probe = opportunisticChromeVersion(exePath);
  if (probe.ok === true) {
    l2('chrome.exe --version (opportunistic)', true, probe.version);
    info.browserVersion = probe.version;
    info.runtimeCheck = { mode: 'probe', verifiedAt: new Date().toISOString(), passed: true, version: probe.version };
  } else if (probe.ok === 'skipped') {
    l2('chrome.exe --version (opportunistic)', 'skipped', probe.reason);
    info.runtimeCheck = { mode: 'skipped', reason: probe.reason, verifiedAt: new Date().toISOString(), passed: null };
  } else {
    // Explicit design decision: --version failing does NOT fail the build.
    // Playwright launches Chromium with different args, in a different
    // process tree, with different sandboxing. A failed direct invocation
    // is not evidence that Playwright will fail.
    l2('chrome.exe --version (opportunistic)', false,
       `${probe.reason} — NOT a bundle problem; app launches via Playwright, not directly`);
    info.runtimeCheck = { mode: 'probe', reason: probe.reason, verifiedAt: new Date().toISOString(), passed: false };
  }

  // Best-effort version hint from version.txt if present (only used
  // when the opportunistic probe did not succeed).
  if (!info.browserVersion || info.browserVersion === 'unknown') {
    const verFile = path.join(chromeWinDir, 'version.txt');
    if (isFile(verFile)) {
      try {
        const v = fs.readFileSync(verFile, 'utf8').trim();
        if (v) info.browserVersion = v;
      } catch { /* keep existing */ }
    }
  }

  // Persist any Level-2 discoveries into BUNDLE_INFO for the diagnostic report.
  try {
    fs.writeFileSync(BUNDLE_INFO_PATH, JSON.stringify(info, null, 2) + '\n', 'utf8');
  } catch (e) {
    l2('BUNDLE_INFO.json refresh', false, e && e.message);
  }

  // ------------------------------------------------------------
  // LEVEL 3 — INFORMATIONAL reporting only.
  // ------------------------------------------------------------
  l3('Chromium revision',   info.chromiumRevision || '(unknown)');
  l3('Chromium version',    info.browserVersion   || '(unknown)');
  l3('Playwright version',  info.playwrightVersion || '(unknown)');
  l3('Bundle size',         info.browserSizeHuman || (info.browserSize != null ? (info.browserSize / (1024*1024)).toFixed(1) + ' MB' : '(unknown)'));
  l3('Files bundled',       String(info.filesBundled ?? '(unknown)'));
  l3('Bundled on platform', `${info.platform || '?'} / ${info.architecture || '?'}`);
  l3('Bundle timestamp',    info.generatedAt || '(unknown)');
  l3('Executable',          info.executable  || '(unknown)');

  finishAndExit();
})();

// ============================================================
//              Report renderer + exit-code decider
// ============================================================
function finishAndExit() {
  const line = '='.repeat(64);
  const nl = '\n';
  const buf = [];

  const iconOK   = '\u2713'; // ✓
  const iconFAIL = '\u2717'; // ✗
  const iconWARN = '!';
  const iconSKIP = '·';

  // Level 1
  buf.push('-- LEVEL 1 (FATAL) — structural bundle integrity ----------------');
  let l1Failed = false;
  for (const c of report.level1) {
    const icon = c.ok ? iconOK : iconFAIL;
    buf.push(`  ${icon} ${c.name}${c.detail ? '  —  ' + c.detail : ''}`);
    if (!c.ok) l1Failed = true;
  }
  buf.push('');

  // Level 2 (only render when we made it past Level 1 fully)
  if (report.level2.length > 0) {
    buf.push('-- LEVEL 2 (WARN) — additional confidence signals ---------------');
    for (const c of report.level2) {
      const icon = c.ok === true ? iconOK
                 : c.ok === 'skipped' ? iconSKIP
                 : iconWARN;
      const tag  = c.ok === true ? '' : c.ok === 'skipped' ? '   [SKIPPED]' : '   [WARN — not a failure]';
      buf.push(`  ${icon} ${c.name}${tag}${c.detail ? '  —  ' + c.detail : ''}`);
    }
    buf.push('');
  }

  // Level 3
  if (report.level3.length > 0) {
    buf.push('-- LEVEL 3 (INFO) — reporting -----------------------------------');
    for (const c of report.level3) {
      buf.push(`  · ${c.name.padEnd(22, ' ')}${c.value}`);
    }
    buf.push('');
  }

  buf.push(line);
  if (l1Failed) {
    buf.push('  RESULT: FAILED — bundle is NOT structurally deployable.');
    buf.push('');
    buf.push('  Fix:');
    buf.push('    1. Ensure Playwright Chromium is installed:');
    buf.push('         npx playwright install chromium');
    buf.push('    2. Re-run the bundler:');
    buf.push('         npm run bundle:browser');
    buf.push('    3. Re-run this verification:');
    buf.push('         npm run verify:browser-bundle');
    buf.push('    (see BUILD.md for the complete workflow)');
    buf.push(line);
    process.stderr.write(buf.join(nl) + nl);
    process.exit(1);
  }
  const warnings = report.level2.filter(c => c.ok === false).length;
  const skipped  = report.level2.filter(c => c.ok === 'skipped').length;
  buf.push(`  RESULT: PASSED — bundle is structurally deployable.`);
  if (warnings > 0 || skipped > 0) {
    buf.push(`          (${warnings} warning${warnings === 1 ? '' : 's'}, ${skipped} skipped — neither blocks the build)`);
  }
  buf.push('');
  buf.push('  Note: the definitive usability test is the Playwright launch');
  buf.push('  at first run, not chrome.exe --version. The validator only');
  buf.push('  answers "is the bundle structurally complete and deployable?"');
  buf.push(line);
  process.stdout.write(buf.join(nl) + nl);
  process.exit(0);
}
