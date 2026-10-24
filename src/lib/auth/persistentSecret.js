import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { getAppDatabase } from "../../../db/index.js";

// One atomic upsert returns the same value to concurrent cold starts. Keep
// this private table out of application backups and management API responses.
export async function getPersistentSecret(key) {
  try {
    const generated = crypto.randomBytes(32).toString("hex");
    const result = await getAppDatabase().execute(sql`
      INSERT INTO app_secrets (key, value) VALUES (${key}, ${generated})
      ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key
      RETURNING value
    `);
    const row = result.rows?.[0] ?? result[0];
    if (!row?.value) throw new Error("Missing authentication storage result");
    return row.value;
  } catch {
    // Driver errors include SQL parameters. Do not propagate them to Next's
    // error reporting, where authentication material could enter build logs.
    throw new Error("Unable to initialize authentication storage");
  }
}
