/**
 * Behavioural test for PlaywrightService.validateSession()
 *
 * Runs inside a real Electron main process (so `playwright` and native modules
 * are exercised the same way they will be in production).
 *
 * Serves three tiny pages via a local HTTP server:
 *   /login       → login form present (URL also matches /login pattern)
 *   /dashboard   → logged in but no deposit table
 *   /monitoring  → deposit table present  → valid session
 *
 * For each URL, navigates the persistent context and asserts the expected
 * `{ ok, reason }` shape from validateSession().
 */

const { app } = require('electron');
const http = require('http');
const path = require('path');

// Resolve the compiled PlaywrightService and AppDirectoryManager from dist/.
const projectRoot = path.resolve(__dirname, '..');
const { PlaywrightService } = require(path.join(projectRoot, 'dist/main/main/services/playwright-service.js'));
const { AppDirectoryManager } = require(path.join(projectRoot, 'dist/main/main/services/app-directory-manager.js'));
const { initializeLogger } = require(path.join(projectRoot, 'dist/main/main/services/logger-service.js'));

const PAGES = {
  '/login': `<!doctype html><html><head><title>Login</title></head><body>
    <h1>Please sign in</h1>
    <form id="login-form"><input name="u"><input name="p" type="password"><button>Sign in</button></form>
  </body></html>`,
  '/dashboard': `<!doctype html><html><head><title>Dashboard</title></head><body>
    <h1>Welcome</h1><p>No table here. Navigate to deposits to start monitoring.</p>
  </body></html>`,
  '/monitoring': `<!doctype html><html><head><title>Deposits</title></head><body>
    <h1>Deposits</h1>
    <table class="table table-striped b-t"><thead><tr><th>#</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>
  </body></html>`,
};

async function main() {
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (PAGES[url]) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(PAGES[url]);
    } else {
      res.writeHead(302, { Location: '/login' });
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  const results = [];
  let exitCode = 0;

  try {
    const appDir = new AppDirectoryManager();
    initializeLogger(appDir.getLogsDir());

    const svc = new PlaywrightService(appDir);
    await svc.launch(`${base}/login`);
    const page = svc.getPage();

    const cases = [
      { path: '/login',      wantOk: false, wantReasonHas: 'login' },
      { path: '/dashboard',  wantOk: false, wantReasonHas: 'Deposit table' },
      { path: '/monitoring', wantOk: true,  wantReasonHas: null },
    ];

    for (const c of cases) {
      await page.goto(`${base}${c.path}`, { waitUntil: 'domcontentloaded' });
      // Give any lazy DOM a tick
      await page.waitForTimeout(150);
      const r = await svc.validateSession();
      const okMatches = r.ok === c.wantOk;
      const reasonMatches = c.wantReasonHas
        ? (r.reason && r.reason.toLowerCase().includes(c.wantReasonHas.toLowerCase()))
        : !r.reason;
      const pass = okMatches && reasonMatches;
      if (!pass) exitCode = 1;
      results.push({ path: c.path, expected: { ok: c.wantOk, reasonHas: c.wantReasonHas }, got: r, pass });
    }

    // Extra case: no browser page
    await svc.close();
    const r4 = await svc.validateSession();
    const pass4 = r4.ok === false && r4.reason === 'Browser not launched';
    if (!pass4) exitCode = 1;
    results.push({ path: '(closed)', expected: { ok: false, reason: 'Browser not launched' }, got: r4, pass: pass4 });

  } catch (e) {
    console.error('TEST_HARNESS_FAIL', e && e.stack ? e.stack : e);
    exitCode = 2;
  } finally {
    server.close();
    for (const r of results) {
      console.log(r.pass ? 'PASS' : 'FAIL', JSON.stringify(r));
    }
    console.log(exitCode === 0 ? 'ALL_PASS' : 'SOME_FAIL');
    app.exit(exitCode);
  }
}

app.whenReady().then(main);
