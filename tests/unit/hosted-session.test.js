import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({ secret: vi.fn(), getSettings: vi.fn() }));
vi.mock("@/lib/auth/persistentSecret.js", () => ({ getPersistentSecret: mocks.secret }));
vi.mock("@/lib/localDb", () => ({ getSettings: mocks.getSettings }));

describe("hosted dashboard sessions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NETLIFY", "true");
    vi.stubEnv("JWT_SECRET", "");
    mocks.secret.mockReset().mockResolvedValue("unit-test-only-shared-session-fixture");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("does not access secret storage during import and verifies across cold starts", async () => {
    const first = await import("../../src/lib/auth/dashboardSession.js");
    expect(mocks.secret).not.toHaveBeenCalled();
    const token = await first.createDashboardAuthToken();
    vi.resetModules();
    const second = await import("../../src/lib/auth/dashboardSession.js");
    expect(await second.verifyDashboardAuthToken(token)).toBe(true);
    expect(mocks.secret).toHaveBeenCalledTimes(2);
    expect(await second.verifyDashboardAuthToken("invalid-fixture")).toBe(false);
  });

  it("retries secret initialization after a transient storage failure", async () => {
    mocks.secret.mockRejectedValueOnce(new Error("storage unavailable"));
    const session = await import("../../src/lib/auth/dashboardSession.js");
    expect(await session.verifyDashboardAuthToken("invalid-fixture")).toBe(false);
    await session.createDashboardAuthToken();
    expect(mocks.secret).toHaveBeenCalledTimes(2);
  });
});
