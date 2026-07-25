// Verify the rich diagnostic emitted for an unknown production layout.
// A synthetic 17H/18B row must be rejected AND the rejection must carry:
//   • headerLabels (raw thead)
//   • cellTexts    (every <td>)
//   • rowOuterHTML (the raw <tr>)
// exactly as the operator requested, so future layouts can be added
// without touching diagnostics.

const { chromium } = require('playwright');
const path = require('path');

const HEAD = `
  <thead><tr>
    <th>#</th><th>User Name</th><th>Bank</th><th>Account Name</th>
    <th>Account Number</th><th>Payment ID</th><th>Currency</th><th>Amount</th>
    <th>Status</th><th>External ID</th><th>Unrecognised-11</th><th>Deposit Type</th>
    <th>Payment Type</th><th>Agent</th><th>Process Date</th><th>Created At</th>
    <th>Unrecognised-17</th>
  </tr></thead>
`;

// 18 <td>s — no such layout is registered.
const UNKNOWN_ROW = `
  <tr>
    <td>1</td><td>user1</td><td>bank1</td><td>name1</td><td>0000-000-0001</td>
    <td>ext1</td><td>IDR</td><td>50,000.00</td><td>Approved</td><td>ext-uuid</td>
    <td>Yes</td><td>PGA</td><td>PT-VAL</td><td>agent1</td><td>2026-07-24 03:00:00</td>
    <td>2026-07-24 02:59:00</td><td>extra-1</td><td>extra-2</td>
  </tr>
`;

const html = `<!doctype html><html><body>
  <table class="table table-striped b-t">
    ${HEAD}
    <tbody>${UNKNOWN_ROW}</tbody>
  </table>
</body></html>`;

(async () => {
  const distMain = path.resolve(__dirname, '..', 'dist/main/main');
  const loggerSvc = require(path.join(distMain, 'services', 'logger-service.js'));
  const captured = [];
  loggerSvc.getLogger = () => ({
    info: (...a) => captured.push(['INFO', ...a]),
    warn: (...a) => captured.push(['WARN', ...a]),
    error: (...a) => captured.push(['ERR', ...a]),
    debug: () => {},
    success: () => {},
    diag: (...a) => captured.push(['DIAG', ...a]),
    isDiagEnabled: () => true,
  });

  const { HTMLMapper } = require(path.join(distMain, 'services', 'html-mapper.js'));
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html);

  const mapper = new HTMLMapper(page);
  const result = await mapper.parseCurrentPage();

  await browser.close();

  const asserts = [];
  const push = (name, ok, detail='') => asserts.push({ name, ok, detail });

  push('one row rejected', result.rejections.length === 1);
  push('zero transactions', result.transactions.length === 0);
  const rej = result.rejections[0] || {};
  push('rejection reason mentions unknown layout',
    (rej.reason || '').includes('Unknown production layout') && (rej.reason || '').includes('body=18'));
  push('rejection.headerLabels has 17 entries', (rej.headerLabels || []).length === 17);
  push('rejection.cellTexts has 18 entries', (rej.cellTexts || []).length === 18);
  push('rejection.rowOuterHTML contains <tr', (rej.rowOuterHTML || '').startsWith('<tr'));

  // Verify the diag output carried every header label + body cell + <tr> HTML.
  const diagText = captured.filter(c => c[0] === 'DIAG').map(c => c.slice(1).join(' ')).join('\n');
  push('diag prints all 17 header labels', /H\[17\]/.test(diagText));
  push('diag prints all 18 body cells',    /B\[18\]/.test(diagText));
  push('diag prints raw <tr> outerHTML',   diagText.includes('Raw <tr> outerHTML'));

  let failed = 0;
  for (const a of asserts) {
    console.log(`  ${a.ok ? 'PASS' : 'FAIL'}  ${a.name}${a.detail ? ' — ' + a.detail : ''}`);
    if (!a.ok) failed++;
  }
  console.log(`\nDIAG SAMPLE (first rejection):\n${diagText.split('----------------------------------------').slice(1,3).join('----------------------------------------')}`);
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
