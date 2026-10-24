const { test } = require("node:test");
const assert = require("node:assert/strict");

test("authorization transport forwards credentials without trusting peer headers", async () => {
  const { authorize } = await import("../src/lib/auth/authorizationTransport.mjs");
  const request = {
    url: "https://example.test/dashboard",
    nextUrl: { pathname: "/dashboard", search: "" },
    headers: new Headers({ cookie: "fixture=example", "x-fr-real-ip": "127.0.0.1", "x-fr-peer-token": "fixture" }),
  };
  const result = await authorize(request, "guard", async (url, options) => {
    assert.equal(url.pathname, "/api/internal/authorize");
    assert.equal(options.headers.has("cookie"), true);
    assert.equal(options.headers.has("x-fr-peer-token"), false);
    assert.equal(options.headers.has("x-fr-real-ip"), false);
    assert.equal(options.cache, "no-store");
    assert.equal(options.redirect, "error");
    return Response.json({ action: "deny", status: 403 });
  });
  assert.equal(result.action, "deny");
  await assert.rejects(authorize(request, "guard", async () => new Response(null, { status: 503 })));
  await assert.rejects(authorize(request, "guard", async () => Response.json({ action: "unexpected" })));
  await assert.rejects(authorize(request, "session", async () => Response.json({ authenticated: "true" })));
});
