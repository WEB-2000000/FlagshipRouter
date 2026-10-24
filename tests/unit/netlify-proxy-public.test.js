import { beforeEach, describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn() }));
vi.mock("@/lib/auth/authorizationTransport.mjs", () => ({ authorize: mocks.authorize }));
const { proxy } = await import("../../src/lib/auth/netlifyProxyGuard.js");

function request(pathname) {
  return { url: `https://example.test${pathname}`, nextUrl: { pathname, search: "" }, headers: new Headers() };
}

describe("public entry points during an auth outage", () => {
  beforeEach(() => { mocks.authorize.mockReset().mockRejectedValue(new Error("unavailable")); });
  it("serves login and health without calling the authorization backend", async () => {
    for (const path of ["/login", "/api/health", "/api/auth/status"]) {
      expect((await proxy(request(path))).headers.get("x-middleware-next")).toBe("1");
    }
    expect(mocks.authorize).not.toHaveBeenCalled();
  });
  it("keeps the dashboard and management APIs closed during an outage", async () => {
    for (const path of ["/dashboard", "/api/keys"]) {
      expect((await proxy(request(path))).status).toBe(503);
    }
  });
});
