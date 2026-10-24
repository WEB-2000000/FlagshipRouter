import { beforeEach, describe, it, expect, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("../../db/index.js", () => ({ getAppDatabase: () => ({ execute: mocks.execute }) }));
const { getPersistentSecret } = await import("../../src/lib/auth/persistentSecret.js");

describe("shared authentication secret storage", () => {
  beforeEach(() => { mocks.execute.mockReset(); });
  it("uses an atomic parameterized upsert and preserves the first value", async () => {
    const rows = new Map();
    mocks.execute.mockImplementation(async (statement) => {
      const query = new PgDialect().sqlToQuery(statement);
      expect(query.sql).toMatch(/ON CONFLICT \(key\) DO UPDATE SET key = EXCLUDED.key/);
      expect(query.params).toHaveLength(2);
      const [key, candidate] = query.params;
      if (!rows.has(key)) rows.set(key, candidate);
      return { rows: [{ value: rows.get(key) }] };
    });
    const results = await Promise.all([getPersistentSecret("session-fixture"), getPersistentSecret("session-fixture")]);
    expect(results[0] === results[1]).toBe(true);
  });
  it("rejects an empty storage result instead of creating an instance-local key", async () => {
    mocks.execute.mockResolvedValue({ rows: [] });
    await expect(getPersistentSecret("session-fixture")).rejects.toThrow("Unable to initialize authentication storage");
  });
  it("removes driver SQL and parameters from propagated failures", async () => {
    mocks.execute.mockRejectedValue(Object.assign(new Error("driver query failure"), { query: "fixture SQL", params: ["fixture parameter"] }));
    let failure;
    try { await getPersistentSecret("session-fixture"); } catch (error) { failure = error; }
    expect(failure.message).toBe("Unable to initialize authentication storage");
    expect(failure.params).toBeUndefined();
    expect(failure.query).toBeUndefined();
    expect(failure.cause).toBeUndefined();
  });
});
