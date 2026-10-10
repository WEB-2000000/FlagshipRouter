import { TABLES, SCHEMA_VERSION, buildCreateTablePostgresSql } from "./schema.js";
import { toPostgresSql } from "./adapters/postgresAdapter.js";

function stripColumnConstraints(columnDefinition) {
  return columnDefinition
    .replace(/\bPRIMARY KEY\b/gi, "")
    .replace(/\bUNIQUE\b/gi, "")
    .replace(/\bAUTOINCREMENT\b/gi, "")
    .replace(/\bREAL\b/gi, "DOUBLE PRECISION")
    .trim();
}

export async function runPostgresMigrationOnce(adapter) {
  const db = adapter.migrationAdapter || adapter;
  await db.transaction(async () => {
    // Serialize cold-start schema checks across Vercel instances.
    await db.get("SELECT pg_advisory_xact_lock(8675309, 1)");

    await db.execPostgres(buildCreateTablePostgresSql("_meta", TABLES._meta));
    const currentRow = await db.get("SELECT value FROM _meta WHERE key = ?", ["schemaVersion"]);
    const currentVersion = Number.parseInt(currentRow?.value ?? "0", 10) || 0;
    if (currentVersion > SCHEMA_VERSION) {
      throw new Error(`PostgreSQL schema ${currentVersion} is newer than this application supports (${SCHEMA_VERSION})`);
    }

    for (const [tableName, definition] of Object.entries(TABLES)) {
      await db.execPostgres(buildCreateTablePostgresSql(tableName, definition));
      const existing = await db.all(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ?",
        [tableName],
      );
      const existingNames = new Set(existing.map((row) => row.column_name));

      for (const [columnName, columnDefinition] of Object.entries(definition.columns)) {
        if (existingNames.has(columnName)) continue;
        if (/\bPRIMARY KEY\b|\bUNIQUE\b/i.test(columnDefinition)) {
          throw new Error(`Missing key column ${tableName}.${columnName} requires an explicit PostgreSQL migration`);
        }
        const safeDefinition = stripColumnConstraints(columnDefinition);
        await db.execPostgres(toPostgresSql(
          `ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${columnName}" ${safeDefinition}`,
        ));
        console.log(`[DB][postgres-sync] +column ${tableName}.${columnName}`);
      }

      for (const indexSql of definition.indexes || []) {
        await db.execPostgres(toPostgresSql(indexSql));
      }
    }

    await db.run(
      "INSERT INTO _meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["schemaVersion", String(SCHEMA_VERSION)],
    );
    await db.run(
      "INSERT INTO _meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["backupSchemaVersion", String(SCHEMA_VERSION)],
    );
  });

  console.log(`[DB][postgres] schema ready at version ${SCHEMA_VERSION}`);
}
