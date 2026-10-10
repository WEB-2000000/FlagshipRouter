import fs from "node:fs";
import initSqlJs from "sql.js";
import { PRAGMA_SQL } from "../schema.js";

let SQL = null;

async function loadSql() {
  if (SQL) return SQL;
  SQL = await initSqlJs();
  return SQL;
}

export async function createSqlJsAdapter(filePath) {
  const SQLLib = await loadSql();
  const buf = fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
  const db = new SQLLib.Database(buf);
  db.exec(PRAGMA_SQL);
  // Schema is created/synced by migrate.js after adapter init

  let dirty = false;
  let saveTimer = null;
  let transactionDepth = 0;
  const dirtyBeforeTransaction = [];
  const SAVE_DEBOUNCE_MS = 100;

  function persist() {
    const data = db.export();
    fs.writeFileSync(filePath, Buffer.from(data));
    dirty = false;
  }

  function scheduleSave() {
    dirty = true;
    if (transactionDepth > 0) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (dirty && transactionDepth === 0) {
        try { persist(); } catch (e) { console.error("[sqljs] save failed:", e); }
      }
    }, SAVE_DEBOUNCE_MS);
  }

  function paramsObj(params) {
    if (!params || (Array.isArray(params) && params.length === 0)) return undefined;
    return params;
  }

  function run(sql, params = []) {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(paramsObj(params));
      stmt.step();
      const changes = db.getRowsModified();
      const lastInsertRowid = db.exec("SELECT last_insert_rowid() as id")[0]?.values?.[0]?.[0] ?? null;
      scheduleSave();
      return { changes, lastInsertRowid };
    } finally {
      stmt.free();
    }
  }

  function get(sql, params = []) {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(paramsObj(params));
      if (stmt.step()) return stmt.getAsObject();
      return undefined;
    } finally {
      stmt.free();
    }
  }

  function all(sql, params = []) {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(paramsObj(params));
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  }

  function exec(sql) {
    db.exec(sql);
    const command = String(sql).trim().match(/^(BEGIN|SAVEPOINT|COMMIT|END|RELEASE|ROLLBACK)\b/i)?.[1]?.toUpperCase();
    if (command === "BEGIN" || command === "SAVEPOINT") {
      if (transactionDepth === 0 && saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
      dirtyBeforeTransaction.push(dirty);
      transactionDepth++;
    } else if (command === "COMMIT" || command === "END" || command === "RELEASE") {
      if (transactionDepth > 0) transactionDepth--;
      dirtyBeforeTransaction.pop();
      if (transactionDepth === 0 && dirty) scheduleSave();
    } else if (command === "ROLLBACK" && !/^ROLLBACK\s+TO\b/i.test(String(sql).trim())) {
      if (transactionDepth > 0) transactionDepth--;
      dirty = dirtyBeforeTransaction.pop() ?? dirty;
      if (transactionDepth === 0 && dirty) scheduleSave();
    } else if (transactionDepth === 0) {
      scheduleSave();
    }
  }

  function transaction(fn) {
    const sp = `sp_${Math.random().toString(36).slice(2)}`;
    exec(`SAVEPOINT ${sp}`);
    try {
      const result = fn();
      exec(`RELEASE ${sp}`);
      return result;
    } catch (e) {
      try { exec(`ROLLBACK TO ${sp}`); exec(`RELEASE ${sp}`); } catch {}
      throw e;
    }
  }

  function close() {
    if (saveTimer) clearTimeout(saveTimer);
    if (dirty) persist();
    db.close();
  }

  // Flush on shutdown
  const flush = () => { if (dirty) try { persist(); } catch {} };
  process.on("beforeExit", flush);
  process.on("SIGINT", flush);
  process.on("SIGTERM", flush);

  return { driver: "sql.js", run, get, all, exec, transaction, close, raw: db };
}
