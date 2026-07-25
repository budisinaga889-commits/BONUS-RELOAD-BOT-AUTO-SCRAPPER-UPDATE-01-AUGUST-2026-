/**
 * Runtime verification for BUG #2 (pagination navigation mismatch) and
 * BUG #3 (browser state validation).
 *
 * Scenarios:
 *   A) URL updates but the panel resets pagination to page 1 (server-side reset)
 *      → widget-vs-URL disagreement → engine must abort with CYCLE-FATAL.
 *   B) Healthy 3-page navigation → scanner visits pages 1,2,3 in order and
 *      stops correctly (hasNextPage=false on page 3).
 *   C) `rel="next"` present outside the pagination widget (decoy) MUST NOT
 *      be clicked — scanner must scope to the pagination container.
 *   D) `href="#"` and `aria-disabled="true"` next anchors → hasNextPage=false.
 */
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

function panelFixture({ maxPages, urlLies = false, decoy = false, brokenNext = false }) {
  // A minimal Yii2/Bootstrap-style pagination panel.
  // When `urlLies=true`, clicking "Next" sets URL to ?page=2 but the widget
  // active stays at 1 (server reset). When `decoy=true`, an unrelated
  // <a rel="next"> anchor appears elsewhere on the page.
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Mock Panel</title></head>
<body>
${decoy ? '<div id="decoy"><a rel="next" href="/decoy-target">Decoy Next</a></div>' : ''}
<table class="table table-striped b-t"><thead><tr><th>#</th></tr></thead>
<tbody><tr><td>row</td></tr></tbody></table>
<ul class="pagination" id="pg"></ul>
<script>
(function(){
  const MAX = ${maxPages};
  const URL_LIES = ${urlLies};
  const BROKEN = ${brokenNext};
  let current = 1;
  function render() {
    const pg = document.getElementById('pg');
    const parts = [];
    for (let i=1; i<=MAX; i++) {
      const active = (i === current) ? 'active' : '';
      parts.push('<li class="'+active+'"><a href="?page='+i+'">'+i+'</a></li>');
    }
    if (current < MAX) {
      const href = BROKEN ? '#' : ('?page='+(current+1));
      const dis  = BROKEN ? 'aria-disabled="true"' : '';
      parts.push('<li><a rel="next" href="'+href+'" '+dis+'>Next</a></li>');
    } else {
      parts.push('<li class="disabled"><a rel="next" href="#" aria-disabled="true">Next</a></li>');
    }
    pg.innerHTML = parts.join('');
    pg.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', function(e){
        e.preventDefault();
        const href = this.getAttribute('href') || '';
        if (!href || href === '#') return;
        const m = href.match(/[?&]page=(\\d+)/);
        if (!m) return;
        const target = parseInt(m[1], 10);
        // Update URL (history) — this always happens.
        history.pushState({}, '', '?page='+target);
        if (URL_LIES) {
          // Server-side reset: URL says target, widget stays at 1.
          current = 1;
        } else {
          current = target;
        }
        render();
      });
    });
  }
  render();
})();
</script>
</body></html>`;
}

async function withServer(html, fn) {
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(html);
  });
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  try {
    return await fn(`http://127.0.0.1:${port}/`);
  } finally {
    server.close();
  }
}

async function main() {
  execSync('NODE_OPTIONS="--max-old-space-size=4096" npx tsc -p tsconfig.main.json', { stdio: 'inherit' });
  const { PageScanner } = require('../dist/main/main/services/page-scanner');
  const { initializeLogger } = require('../dist/main/main/services/logger-service');
  const tmpLogs = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-'));
  const logger = initializeLogger(tmpLogs);
  logger.setDiagEnabled(true);

  const results = { passed: 0, failed: 0, notes: [] };

  // Case B: healthy 3-page navigation
  await withServer(panelFixture({ maxPages: 3 }), async (url) => {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.goto(url);
      const scanner = new PageScanner(page);
      scanner.setLatestProcessedDate(null);
      const r = await scanner.scanPages({ id: 'x', name: 'B', enabled: true, priority: 1 }, 10);
      const pagesVisited = r.perPage.map(p => p.pageNumber);
      const ok = JSON.stringify(pagesVisited) === '[1,2,3]' && r.navigationFailure === false;
      if (ok) { results.passed++; results.notes.push(`PASS Case B (healthy 3-page): visited ${JSON.stringify(pagesVisited)}, navigationFailure=false`); }
      else { results.failed++; results.notes.push(`FAIL Case B: visited=${JSON.stringify(pagesVisited)}, navigationFailure=${r.navigationFailure}`); }
    } finally { await browser.close(); }
  });

  // Case A: URL lies (server-side reset simulating Bug #2 root cause)
  await withServer(panelFixture({ maxPages: 3, urlLies: true }), async (url) => {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.goto(url);
      const scanner = new PageScanner(page);
      scanner.setLatestProcessedDate(null);
      const r = await scanner.scanPages({ id: 'x', name: 'A', enabled: true, priority: 1 }, 10);
      if (r.navigationFailure) { results.passed++; results.notes.push(`PASS Case A (URL lies): navigationFailure=true, pages=${JSON.stringify(r.perPage.map(p=>p.pageNumber))}`); }
      else { results.failed++; results.notes.push(`FAIL Case A: scanner did not detect URL/widget disagreement`); }
    } finally { await browser.close(); }
  });

  // Case C: decoy rel="next" outside pagination container
  await withServer(panelFixture({ maxPages: 2, decoy: true }), async (url) => {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.goto(url);
      // Sabotage: replace the pagination's next href with a page=2 link but
      // also give the decoy the same rel="next" — the scanner must click the
      // one INSIDE .pagination, not the decoy.
      const scanner = new PageScanner(page);
      scanner.setLatestProcessedDate(null);
      const r = await scanner.scanPages({ id: 'x', name: 'C', enabled: true, priority: 1 }, 10);
      const pagesVisited = r.perPage.map(p => p.pageNumber);
      const ok = JSON.stringify(pagesVisited) === '[1,2]' && r.navigationFailure === false;
      if (ok) { results.passed++; results.notes.push(`PASS Case C (decoy ignored): visited ${JSON.stringify(pagesVisited)}`); }
      else { results.failed++; results.notes.push(`FAIL Case C: visited=${JSON.stringify(pagesVisited)}, navFailure=${r.navigationFailure}`); }
    } finally { await browser.close(); }
  });

  // Case D: href="#" + aria-disabled → hasNextPage returns false, single page scanned
  await withServer(panelFixture({ maxPages: 3, brokenNext: true }), async (url) => {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.goto(url);
      const scanner = new PageScanner(page);
      scanner.setLatestProcessedDate(null);
      const r = await scanner.scanPages({ id: 'x', name: 'D', enabled: true, priority: 1 }, 10);
      const pagesVisited = r.perPage.map(p => p.pageNumber);
      const ok = JSON.stringify(pagesVisited) === '[1]' && r.navigationFailure === false;
      if (ok) { results.passed++; results.notes.push(`PASS Case D (broken next href="#"): visited [1], no error`); }
      else { results.failed++; results.notes.push(`FAIL Case D: visited=${JSON.stringify(pagesVisited)}, navFailure=${r.navigationFailure}`); }
    } finally { await browser.close(); }
  });

  console.log('\n=== BUG #2 + #3 verification ===');
  for (const n of results.notes) console.log('  •', n);
  console.log(`\nPASSED: ${results.passed}   FAILED: ${results.failed}`);
  fs.rmSync(tmpLogs, { recursive: true, force: true });
  process.exit(results.failed === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(2); });
