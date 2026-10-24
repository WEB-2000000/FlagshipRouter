import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ proxy: vi.fn(), isAuthenticated: vi.fn() }));
vi.mock("@/dashboardGuard", () => mocks);
const { GET } = await import("../../src/app/api/internal/middleware-auth/route.js");
function request(path, headers = {}) {
  const url = new URL("https://router.example/api/internal/middleware-auth");
  url.searchParams.set("path", path);
  return new NextRequest(url, { headers });
}
beforeEach(() => vi.clearAllMocks());

describe("Node.js authorization endpoint", () => {
  it("checks the original request and returns only the access decision", async () => {
    mocks.proxy.mockResolvedValue(NextResponse.next());
    mocks.isAuthenticated.mockResolvedValue(true);
    const response = await GET(request("/v1beta/models?key=test", { cookie: "9r_mimo_login=session" }));
    const original = mocks.proxy.mock.calls[0][0];
    expect(original.nextUrl.pathname).toBe("/v1beta/models");
    expect(original.nextUrl.searchParams.get("key")).toBe("test");
    expect(original.cookies.get("9r_mimo_login").value).toBe("session");
    expect(await response.json()).toMatchObject({ allow: true, authenticated: true });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("serializes unauthorized responses", async () => {
    mocks.proxy.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    expect(await (await GET(request("/api/settings"))).json()).toMatchObject({ allow: false, status: 401, error: "Unauthorized" });
  });

  it("serializes redirects", async () => {
    mocks.proxy.mockResolvedValue(NextResponse.redirect("https://router.example/login"));
    expect(await (await GET(request("/dashboard"))).json()).toMatchObject({ allow: false, location: "https://router.example/login" });
  });

  it.each(["https://evil.example/dashboard", "//evil.example/dashboard", "/\\evil.example/dashboard"])("rejects foreign targets: %s", async (path) => {
    expect((await GET(request(path))).status).toBe(400);
    expect(mocks.proxy).not.toHaveBeenCalled();
  });

  it("fails closed when the guard throws", async () => {
    mocks.proxy.mockRejectedValue(new Error("database offline"));
    expect((await GET(request("/dashboard"))).status).toBe(503);
  });
});
