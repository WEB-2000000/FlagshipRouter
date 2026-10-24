import { describe, it, expect } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { TABLES } from "../../src/lib/db/schema.js";
import * as schema from "../../db/schema.ts";

describe("hosted storage schema compatibility", () => {
  it("preserves every table and column used by the existing SQL repositories", () => {
    for (const [name, definition] of Object.entries(TABLES)) {
      const table = getTableConfig(schema[name]);
      expect(table.name).toBe(name);
      expect(table.columns.map((column) => column.name).sort()).toEqual(Object.keys(definition.columns).sort());
    }
  });
  it("keeps shared secrets in a separate table outside management exports", () => {
    expect(getTableConfig(schema.appSecrets).name).toBe("app_secrets");
    expect(TABLES.app_secrets).toBeUndefined();
  });
});
