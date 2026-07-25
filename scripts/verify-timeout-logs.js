/**
 * Focused test: verify that a navigation timeout is logged as ERROR and
 * surfaced through the subscribe stream (so the renderer's Live Log shows it).
 *
 * Serves a page whose "Next" link points to a URL that hangs (never
 * responds), forcing waitForFunction(url-changed) to time out.
 */

const { app } = require('electron');
const http = require('http');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const D = (p) => require(path.join(projectRoot, 'dist/main/main', p));
const { AppDirectoryManager } = D('services/app-directory-manager.js');
const { initializeLogger } = D('services/logger-service.js');
const { PlaywrightService } = D('services/playwright-service.js');
const { PageScanner } = D('services/page-scanner.js');

async function main() {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/hang')) {
      // Never respond — makes the URL-change wait time out.
      return;
    }
    if (req.url.startsWith('/deposits')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!doctype html><html><body>
        <table class="table table-striped b-t">
          <thead><tr><th>#</th><th>User</th><th>Bank</th><th>AccName</th><th>AccNum</th><th>PayId</th>
            <th>Cur</th><th>Amt</th><th>Status</th><th>Ext</th><th>Done</th>
            <th>DepType</th><th>PayType</th><th>Agent</th><th>ProcDate</th><th>CreatedAt</th></tr></thead>
          <tbody><tr>
            <td>1</td><td>u</td><td>b</td><td>a</td><td>111</td><td>p</td>
            <td>USD</td><td>1</td><td>Approved</td><td>e</td><td>Yes</td>
            <td>CASH</td><td>IN</td><td>agt</td><td>2026-02-10 10:00</td><td>2026-02-10 10:01</td>
          </tr></tbody>
        </table>
        <a rel="next" href="/hang"></a>
      </body></html>`);
      return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  
  const captured = [];
  let exitCode = 0;
  try {
    const appDir = new AppDirectoryManager();
    const logger = initializeLogger(appDir.getLogsDir());
    logger.subscribe((e) => captured.push(e));
    
    const svc = new PlaywrightService(appDir);
    await svc.launch(`${base}/deposits`);
    const scanner = new PageScanner(svc.getPage());
    
    // Scan with a fake filter — this triggers navigation to /hang which never returns.
    await scanner.scanPages({ id: '1', name: 'test', enabled: true, priority: 1 }, 3);
    
    await svc.close();
    
    // Assert an ERROR-level log was emitted mentioning navigation / timeout / pagination.
    const errorLogs = captured.filter((c) => c.level === 'ERROR');
    const relevantError = errorLogs.find((e) =>
      /timeout|navigat|pagination/i.test(e.message)
    );
    console.log('ERROR_LOG_COUNT', errorLogs.length);
    console.log('ERROR_SAMPLE', relevantError ? JSON.stringify({ level: relevantError.level, message: relevantError.message }) : 'NONE');
    if (!relevantError) exitCode = 1;
    console.log(exitCode === 0 ? 'ALL_PASS' : 'SOME_FAIL');
  } catch (e) {
    console.error('TEST_HARNESS_FAIL', e && e.stack ? e.stack : e);
    exitCode = 2;
  } finally {
    server.close();
    app.exit(exitCode);
  }
}

app.whenReady().then(main);
