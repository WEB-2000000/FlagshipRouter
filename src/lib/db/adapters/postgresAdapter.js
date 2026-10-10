import { AsyncLocalStorage } from "node:async_hooks";
import { TABLES } from "../schema.js";

const identifierNames = new Map();
for (const [tableName, definition] of Object.entries(TABLES)) {
  identifierNames.set(tableName.toLowerCase(), tableName);
  for (const columnName of Object.keys(definition.columns)) {
    identifierNames.set(columnName.toLowerCase(), columnName);
  }
}

function replaceSqliteInsertModes(sql) {
  const pattern = /^(\s*INSERT)\s+OR\s+(REPLACE|IGNORE)\s+INTO\s+([A-Za-z_][\w]*)\s*(\([^)]*\))([\s\S]*)$/i;
  const match = String(sql).match(pattern);
  if (!match) return sql;
  const [, insertKeyword, mode, tableName, columnClause, remainder] = match;
  const columns = columnClause.slice(1, -1).split(",").map((column) => column.trim()).filter(Boolean);
  if (!columns.length) throw new Error(`Cannot translate SQLite INSERT OR ${mode}: missing column list`);
  const semicolon = /;\s*$/.test(remainder) ? remainder.match(/;\s*$/)[0] : "";
  const body = semicolon ? remainder.slice(0, -semicolon.length) : remainder;
  const insert = `${insertKeyword} INTO ${tableName} ${columnClause}${body}`;
  if (mode.toUpperCase() === "IGNORE") return `${insert.trimEnd()} ON CONFLICT DO NOTHING${semicolon}`;
  const table = Object.keys(TABLES).find((name) => name.toLowerCase() === tableName.toLowerCase());
  const definition = table ? TABLES[table] : null;
  let conflictColumns = definition?.primaryKey?.match(/\(([^)]*)\)/)?.[1]
    ?.split(",").map((column) => column.trim()).filter(Boolean);
  if (!conflictColumns?.length && definition) {
    const primary = Object.entries(definition.columns).find(([, value]) => /\bPRIMARY KEY\b/i.test(value));
    if (primary) conflictColumns = [primary[0]];
  }
  if (!conflictColumns?.length && definition) {
    const unique = Object.entries(definition.columns).find(([, value]) => /\bUNIQUE\b/i.test(value));
    if (unique) conflictColumns = [unique[0]];
  }
  if (!conflictColumns?.length) {
    throw new Error(`Cannot translate SQLite INSERT OR REPLACE for ${tableName}: no PostgreSQL conflict key is declared`);
  }
  const target = `(${conflictColumns.map((column) => `"${column}"`).join(", ")})`;
  const updates = columns.map((column) => `${column} = excluded.${column}`).join(", ");
  return `${insert.trimEnd()} ON CONFLICT ${target} DO UPDATE SET ${updates}${semicolon}`;
}

function rewriteSqlTokens(sql) {
  let output = "";
  let index = 0;
  let parameter = 0;
  let aliasNext = false;

  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];

    if (char === "'") {
      output += char;
      index++;
      while (index < sql.length) {
        output += sql[index];
        if (sql[index] === "'" && sql[index + 1] === "'") {
          output += sql[index + 1];
          index += 2;
          continue;
        }
        if (sql[index] === "'") { index++; break; }
        if (sql[index] === "\\" && index + 1 < sql.length) output += sql[++index];
        index++;
      }
      aliasNext = false;
      continue;
    }

    if (char === '"') {
      output += char;
      index++;
      while (index < sql.length) {
        output += sql[index];
        if (sql[index] === '"' && sql[index + 1] === '"') {
          output += sql[index + 1];
          index += 2;
          continue;
        }
        if (sql[index] === '"') { index++; break; }
        index++;
      }
      aliasNext = false;
      continue;
    }

    if (char === "-" && next === "-") {
      const end = sql.indexOf("\n", index);
      if (end < 0) { output += sql.slice(index); break; }
      output += sql.slice(index, end + 1);
      index = end + 1;
      continue;
    }

    if (char === "/" && next === "*") {
      const end = sql.indexOf("*/", index + 2);
      if (end < 0) { output += sql.slice(index); break; }
      output += sql.slice(index, end + 2);
      index = end + 2;
      continue;
    }

    if (char === "?") {
      output += `$${++parameter}`;
      index++;
      aliasNext = false;
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let end = index + 1;
      while (end < sql.length && /[A-Za-z0-9_$]/.test(sql[end])) end++;
      const token = sql.slice(index, end);
      const canonical = identifierNames.get(token.toLowerCase());
      const shouldQuoteAlias = aliasNext && (/[a-z][A-Z]/.test(token) || canonical);
      if (shouldQuoteAlias) output += `"${canonical || token}"`;
      else if (canonical) output += `"${canonical}"`;
      else output += token;
      aliasNext = token.toUpperCase() === "AS";
      index = end;
      continue;
    }

    output += char;
    if (!/\s|\.|\(|\)/.test(char)) aliasNext = false;
    index++;
  }

  return output;
}

export function toPostgresSql(sql) {
  return rewriteSqlTokens(replaceSqliteInsertModes(String(sql)));
}

function splitStatements(sql) {
  const statements = [];
  let start = 0;
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const n = sql[i + 1];
    if (lineComment) {
      if (c === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (c === "*" && n === "/") { blockComment = false; i++; }
      continue;
    }
    if (quote) {
      if (c === quote && sql[i + 1] === quote) { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "-" && n === "-") { lineComment = true; i++; continue; }
    if (c === "/" && n === "*") { blockComment = true; i++; continue; }
    if (c === "'" || c === '"') { quote = c; continue; }
    if (c === ";") {
      const statement = sql.slice(start, i).trim();
      if (statement) statements.push(statement);
      start = i + 1;
    }
  }
  const last = sql.slice(start).trim();
  if (last) statements.push(last);
  return statements;
}

function createPoolApi(pool) {
  const context = new AsyncLocalStorage();
  let savepointId = 0;
  let api;

  async function query(sql, params = [], postgresSql = false) {
    const transaction = context.getStore();
    const client = transaction?.api === api ? transaction.client : pool;
    return client.query(postgresSql ? sql : toPostgresSql(sql), params);
  }

  async function transaction(fn) {
    const active = context.getStore();
    if (active?.api === api) {
      const savepoint = `fr_sp_${++savepointId}`;
      await active.client.query(`SAVEPOINT ${savepoint}`);
      try {
        const result = await context.run({ api, client: active.client }, fn);
        await active.client.query(`RELEASE SAVEPOINT ${savepoint}`);
        return result;
      } catch (error) {
        try {
          await active.client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
          await active.client.query(`RELEASE SAVEPOINT ${savepoint}`);
        } catch {}
        throw error;
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await context.run({ api, client }, fn);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  }

  api = {
    driver: "postgres",
    async run(sql, params = []) {
      const result = await query(sql, params);
      return {
        changes: Number(result.rowCount ?? 0),
        lastInsertRowid: Number(result.rows?.[0]?.id ?? 0),
      };
    },
    async get(sql, params = []) {
      const result = await query(sql, params);
      return result.rows[0];
    },
    async all(sql, params = []) {
      const result = await query(sql, params);
      return result.rows;
    },
    async exec(sql) {
      let result;
      for (const statement of splitStatements(String(sql))) result = await query(statement);
      return result;
    },
    async execPostgres(sql) {
      let result;
      for (const statement of splitStatements(String(sql))) result = await query(statement, [], true);
      return result;
    },
    transaction,
    async close() { await pool.end(); },
  };

  return api;
}

export async function createPostgresAdapter() {
  const applicationUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!applicationUrl) throw new Error("PostgreSQL adapter selected without POSTGRES_URL or DATABASE_URL");
  const migrationUrl = process.env.POSTGRES_URL_NON_POOLING || applicationUrl;

  const pgModule = await import("pg");
  const Pool = pgModule.Pool || pgModule.default?.Pool;
  const types = pgModule.types || pgModule.default?.types;
  if (!Pool) throw new Error("The pg package did not expose Pool");
  types?.setTypeParser?.(20, (value) => Number(value));

  const appPool = new Pool({
    connectionString: applicationUrl,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: true,
  });
  appPool.on("error", (error) => console.error(`[DB] PostgreSQL pool error: ${error.message}`));

  try {
    const { attachDatabasePool } = await import("@vercel/functions");
    if (typeof attachDatabasePool === "function") attachDatabasePool(appPool);
  } catch {
    // Local development does not need Vercel's pool lifecycle helper.
  }

  const appAdapter = createPoolApi(appPool);
  if (migrationUrl === applicationUrl) {
    appAdapter.migrationAdapter = appAdapter;
    appAdapter.close = async () => { await appPool.end(); };
    return appAdapter;
  }

  const migrationPool = new Pool({
    connectionString: migrationUrl,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: true,
  });
  migrationPool.on("error", (error) => console.error(`[DB] PostgreSQL migration pool error: ${error.message}`));
  appAdapter.migrationAdapter = createPoolApi(migrationPool);
  appAdapter.close = async () => {
    await Promise.all([appPool.end(), migrationPool.end()]);
  };
  return appAdapter;
}
