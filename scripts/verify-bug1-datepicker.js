/**
 * Runtime verification for BUG #1 (Date auto-population).
 *
 * Reproduces the production panel's date fields as observed:
 *   <input type="text" class="datepicker" name="deposit_process_date_from" value="">
 *   <input type="text" class="datepicker" name="deposit_process_date_to"   value="">
 * with a jQuery Bootstrap-style datepicker whose blur handler CLEARS the value
 * unless the plugin's `changeDate` event has been fired — mirroring the real
 * failure mode. Verifies that `PlaywrightService.applyFilter` populates both
 * fields, the plugin adds the "has-value" class, and Search is submitted with
 * both date values present in FormData.
 */
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');

const FIXTURE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Mock Panel</title>
<script src="https://code.jquery.com/jquery-3.7.1.slim.min.js"></script>
</head>
<body>
<form id="filter-form" method="get" action="/deposits">
  <input id="deposit-agent-name" name="agent" type="text" value="">
  <select id="deposit-status" name="status">
    <option value="">All</option>
    <option value="Approve">Approve</option>
  </select>
  <select id="payment" name="payment">
    <option value="">All</option>
    <option value="Bank">Bank</option>
  </select>
  <input type="text" class="datepicker" name="deposit_process_date_from" value="">
  <input type="text" class="datepicker" name="deposit_process_date_to"   value="">
  <input type="submit" value=" Filter">
</form>
<div id="result">idle</div>
<table class="table table-striped b-t"><thead><tr><th>Data</th></tr></thead><tbody></tbody></table>
<script>
(function(){
  // Minimal Bootstrap-datepicker-style plugin emulation:
  //   * blur handler CLEARS value unless plugin state was updated
  //   * plugin state updated only via changeDate event
  //   * has-value class toggled by plugin
  const state = new WeakMap();
  $('input.datepicker').each(function(){
    state.set(this, { accepted: false });
    const $el = $(this);
    $el.on('changeDate', function(){
      const s = state.get(this);
      s.accepted = true;
      const v = (this.value || '').trim();
      if (v) $el.addClass('has-value'); else $el.removeClass('has-value');
    });
    $el.on('blur', function(){
      const s = state.get(this);
      if (!s.accepted) {
        // Wipe programmatic value that never went through plugin.
        this.value = '';
        $el.removeClass('has-value');
      }
    });
  });
  $('#filter-form').on('submit', function(e){
    e.preventDefault();
    const fd = new FormData(this);
    const f = fd.get('deposit_process_date_from') || '';
    const t = fd.get('deposit_process_date_to')   || '';
    document.getElementById('result').textContent = 'SUBMIT from='+f+' to='+t;
    // Emulate the panel's behavior: only render table when both dates present.
    if (f && t) {
      document.querySelector('table.table.table-striped.b-t tbody').innerHTML = '<tr><td>ok</td></tr>';
    }
  });
})();
</script>
</body></html>`;

async function main() {
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(FIXTURE_HTML);
  });
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;

  // Compile TS main to a temp dir (skipLibCheck saves time).
  const { execSync } = require('child_process');
  execSync('NODE_OPTIONS="--max-old-space-size=4096" npx tsc -p tsconfig.main.json', { stdio: 'inherit' });

  const { PlaywrightService } = require('../dist/main/main/services/playwright-service');
  const { initializeLogger } = require('../dist/main/main/services/logger-service');
  const tmpLogs = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-logs-'));
  const logger = initializeLogger(tmpLogs);
  logger.setDiagEnabled(true);

  // Fake app-dir manager just for launch (browser profile dir).
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-profile-'));
  const fakeAppDir = { getBrowserProfileDir: () => tmpProfile, getScreenshotsDir: () => tmpLogs };

  const svc = new PlaywrightService(fakeAppDir);
  const results = { passed: 0, failed: 0, notes: [] };

  try {
    const page = await svc.launch(url);
    await page.waitForSelector('input[name="deposit_process_date_from"]');

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth()+1).padStart(2,'0');
    const dd = String(today.getDate()).padStart(2,'0');
    const expected = `${yyyy}-${mm}-${dd}`;

    // Case A: current default page.fill() naive path — asserts the bug reproduces
    // (without plugin notification, blur wipes the value).
    await page.fill('input[name="deposit_process_date_from"]', expected);
    await page.evaluate(() => (document.activeElement).blur());
    const rawA = await page.inputValue('input[name="deposit_process_date_from"]');
    if (rawA === '') {
      results.notes.push('OK: mock reproduces bug (plain fill+blur wipes value) — plugin state needed');
      results.passed++;
    } else {
      results.notes.push(`WARN: mock did not reproduce bug — rawA="${rawA}"`);
    }

    // Case B: applyFilter with manualDateMode=false (auto) must populate both dates.
    await svc.applyFilter({ name: 'test', agent: '', depositType: '' }, { manualDateMode: false }).catch(e => {
      results.notes.push('FAIL: applyFilter(auto) threw: ' + e.message);
      results.failed++;
    });

    const fromVal = await page.inputValue('input[name="deposit_process_date_from"]');
    const toVal   = await page.inputValue('input[name="deposit_process_date_to"]');
    const fromClass = await page.getAttribute('input[name="deposit_process_date_from"]', 'class');
    const toClass   = await page.getAttribute('input[name="deposit_process_date_to"]',   'class');
    if (fromVal === expected && toVal === expected) {
      results.notes.push(`PASS: both dates populated: from="${fromVal}" to="${toVal}"`);
      results.passed++;
    } else {
      results.notes.push(`FAIL: dates not populated: from="${fromVal}" to="${toVal}"`);
      results.failed++;
    }
    if ((fromClass||'').includes('has-value') && (toClass||'').includes('has-value')) {
      results.notes.push('PASS: plugin state class "has-value" present on both inputs');
      results.passed++;
    } else {
      results.notes.push(`FAIL: plugin state class missing: fromClass="${fromClass}" toClass="${toClass}"`);
      results.failed++;
    }
    const resultText = await page.textContent('#result');
    if (resultText && resultText.includes(`from=${expected}`) && resultText.includes(`to=${expected}`)) {
      results.notes.push(`PASS: Search submitted with both dates in FormData: ${resultText}`);
      results.passed++;
    } else {
      results.notes.push(`FAIL: Search did not submit expected dates: ${resultText}`);
      results.failed++;
    }

    // Case C: verify cycle-fatal error is thrown & tagged when date cannot persist.
    // Simulate by removing the datepicker class → jQuery events won't be fired,
    // and force the blur handler to wipe the value (already the case).
    // Instead, verify by pointing to a nonexistent selector.
    try {
      await svc.applyFilter({ name: 'test-missing', agent: '', depositType: '' });
      // Kill DOM to force verify failure on next call
    } catch (e) {
      if (e && e.isCycleFatal) {
        results.notes.push('PASS: cycle-fatal error propagates with isCycleFatal=true');
        results.passed++;
      }
    }

    // Case C: verify cycle-fatal error is thrown & tagged when the field
    // read-back does not equal the intended value. We simulate a hostile
    // panel by having the plugin's changeDate listener reset the value.
    await page.evaluate(() => {
      const w = window;
      if (w.$) {
        w.$('input.datepicker').off('changeDate').on('changeDate', function(){
          // Panel-side sabotage: value gets wiped between fill and read-back.
          this.value = 'WRONG';
        });
      }
      // Reset current values so applyFilter starts empty.
      document.querySelectorAll('input[name^="deposit_process_date"]').forEach(el => { el.value = ''; });
    });
    try {
      await svc.applyFilter({ name: 'test-fatal', agent: '', depositType: '' }, { manualDateMode: false });
      results.notes.push('FAIL: expected cycle-fatal, but applyFilter succeeded');
      results.failed++;
    } catch (e) {
      if (e && e.isCycleFatal) {
        results.notes.push('PASS: cycle-fatal thrown when read-back mismatches ("' + e.message.slice(0,80) + '...")');
        results.passed++;
      } else {
        results.notes.push('FAIL: error not tagged CYCLE-FATAL: ' + e.message);
        results.failed++;
      }
    }
  } finally {
    await svc.close().catch(() => {});
    server.close();
    fs.rmSync(tmpLogs,    { recursive: true, force: true });
    fs.rmSync(tmpProfile, { recursive: true, force: true });
  }

  console.log('\n=== BUG #1 verification ===');
  for (const n of results.notes) console.log('  •', n);
  console.log(`\nPASSED: ${results.passed}   FAILED: ${results.failed}`);
  process.exit(results.failed === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(2); });
