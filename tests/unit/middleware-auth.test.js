import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    next: () => ({ allow: true }),
    json: (body, init) => ({ body, status: init.status }),
    redirect: (url) => ({ location: url.href }),
  },
}));

const { proxy, isAuthenticated } = await import("../../src/lib/middlewareAuth.js");
const request = () => ({
  url: "https://router.example/dashboard?tab=keys",
  headers: new Headers({ cookie: "auth_token=session", "x-middleware-subrequest": "spoofed" }),
});

beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

describe("middleware authorization bridge", () => {
  it("forwards credentials and the original path without forwarding middleware bypass headers", async () => {
    fetch.mockResolvedValue(Response.json({ allow: true, authenticated: true }));
    const req = request();
    expect(await isAuthenticated(req)).toBe(true);
    expect(await proxy(req)).toEqual({ allow: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url.origin).toBe("https://router.example");
    expect(url.pathname).toBe("/api/internal/middleware-auth");
    expect(url.searchParams.get("path")).toBe("/dashboard?tab=keys");
    expect(options.headers.get("cookie")).toBe("auth_token=session");
    expect(options.headers.has("x-middleware-subrequest")).toBe(false);
    expect(options.cache).toBe("no-store");
    expect(options.redirect).toBe("error");
  });

  it("preserves denied API access", async () => {
    fetch.mockResolvedValue(Response.json({ allow: false, authenticated: false, status: 401, error: "Unauthorized" }));
    expect(await proxy(request())).toEqual({ status: 401, body: { error: "Unauthorized" } });
  });

  it("preserves dashboard login redirects", async () => {
    fetch.mockResolvedValue(Response.json({ allow: false, authenticated: false, location: "https://router.example/login" }));
    expect(await proxy(request())).toEqual({ location: "https://router.example/login" });
  });

  it.each(["network", "http", "invalid"])("fails closed on %s errors", async (failure) => {
    if (failure === "network") fetch.mockRejectedValue(new Error("offline"));
    if (failure === "http") fetch.mockResolvedValue(new Response("error", { status: 500 }));
    if (failure === "invalid") fetch.mockResolvedValue(Response.json({}));
    const req = request();
    expect(await isAuthenticated(req)).toBe(false);
    expect((await proxy(req)).status).toBe(503);
  });
});
