import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), getDatabase: vi.fn() }));
vi.mock("@netlify/database", () => ({ getDatabase: mocks.getDatabase }));

describe("Netlify application storage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NETLIFY", "true");
    delete global._dbAdapter;
    mocks.query.mockReset().mockResolvedValue({ rows: [{ data: '{"requireLogin":true}' }], rowCount: 1 });
    mocks.getDatabase.mockReset().mockReturnValue({ pool: { query: mocks.query } });
  });
  afterEach(() => { delete global._dbAdapter; vi.unstubAllEnvs(); });

  it("uses the managed pool without runtime DDL or local SQLite initialization", async () => {
    const { getAdapter } = await import("../../src/lib/db/driver.js");
    const adapter = await getAdapter();
    expect(adapter.driver).toBe("postgres");
    expect(mocks.query).not.toHaveBeenCalled();
    await adapter.get("SELECT data FROM settings WHERE id = ?", [1]);
    expect(mocks.query).toHaveBeenCalledWith('SELECT "data" FROM "settings" WHERE "id" = $1', [1]);
    expect(await getAdapter()).toBe(adapter);
  });

  it("retries pool initialization instead of retaining a rejected promise", async () => {
    mocks.getDatabase.mockImplementationOnce(() => { throw new Error("temporarily unavailable"); });
    const { getAdapter } = await import("../../src/lib/db/driver.js");
    await expect(getAdapter()).rejects.toThrow("temporarily unavailable");
    expect((await getAdapter()).driver).toBe("postgres");
  });
});
