const { test } = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

test("Netlify replaces the native SQLite import while local builds retain it", async () => {
  const original = process.env.NETLIFY;
  try {
    for (const netlify of [true, false]) {
      process.env.NETLIFY = String(netlify);
      const url = pathToFileURL(path.resolve(__dirname, "../next.config.mjs"));
      url.searchParams.set("netlify-test", String(netlify));
      const { default: config } = await import(url.href);
      const result = config.webpack({ resolve: { alias: { existing: "preserved" } } }, { isServer: true });
      assert.equal(config.serverExternalPackages.includes("better-sqlite3"), !netlify);
      // Next's built-in native-package external list must be overridden too;
      // otherwise the replacement alias is bypassed before webpack bundles it.
      assert.equal(config.transpilePackages.includes("better-sqlite3"), netlify);
      assert.equal(result.resolve.alias.existing, "preserved");
      if (netlify) {
        assert.equal(result.resolve.alias["./lib/auth/proxyGuard$"], path.resolve(__dirname, "../src/lib/auth/netlifyProxyGuard.js"));
        const replacement = require(result.resolve.alias["better-sqlite3$"]);
        assert.throws(() => new replacement(), /selecting a supported SQLite driver/);
      } else {
        assert.equal(result.resolve.alias["better-sqlite3$"], undefined);
      }
    }
  } finally {
    if (original === undefined) delete process.env.NETLIFY;
    else process.env.NETLIFY = original;
  }
});
