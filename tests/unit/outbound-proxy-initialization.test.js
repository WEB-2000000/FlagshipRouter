import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ settings: vi.fn(), apply: vi.fn() }));
vi.mock("@/lib/localDb", () => ({ getSettings: mocks.settings }));
vi.mock("@/lib/network/outboundProxy", () => ({ applyOutboundProxyEnv: mocks.apply }));

describe("outbound proxy request-time initialization", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.settings.mockReset();
    mocks.apply.mockReset();
  });
  it("does not read storage during import, then initializes once on demand", async () => {
    mocks.settings.mockResolvedValue({ outboundProxyEnabled: false });
    const { ensureOutboundProxyInitialized } = await import("../../src/lib/network/initOutboundProxy.js");
    await new Promise((resolve) => setImmediate(resolve));
    expect(mocks.settings).not.toHaveBeenCalled();
    expect(await ensureOutboundProxyInitialized()).toBe(true);
    expect(await ensureOutboundProxyInitialized()).toBe(true);
    expect(mocks.settings).toHaveBeenCalledTimes(1);
    expect(mocks.apply).toHaveBeenCalledTimes(1);
  });
  it("retries on the next request after storage becomes available", async () => {
    mocks.settings.mockRejectedValueOnce(new Error("not ready")).mockResolvedValue({});
    const { ensureOutboundProxyInitialized } = await import("../../src/lib/network/initOutboundProxy.js");
    expect(await ensureOutboundProxyInitialized()).toBe(false);
    expect(await ensureOutboundProxyInitialized()).toBe(true);
  });
});
