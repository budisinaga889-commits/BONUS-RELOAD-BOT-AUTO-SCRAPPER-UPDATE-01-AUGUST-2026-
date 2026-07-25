// Verify better-sqlite3 loads correctly under Electron's Node ABI.
// Exits the process with the verification result and quits Electron.
const { app } = require('electron');

app.whenReady().then(() => {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    db.exec("CREATE TABLE t(x INTEGER); INSERT INTO t VALUES(42);");
    const row = db.prepare("SELECT x FROM t").get();
    console.log("SQLITE_OK", JSON.stringify(row));
    db.close();
    app.exit(0);
  } catch (e) {
    console.error("SQLITE_FAIL", e && e.message ? e.message : e);
    app.exit(1);
  }
});
