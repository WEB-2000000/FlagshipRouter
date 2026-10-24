const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("standalone server honors port and host options, rejecting invalid ports", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "router-options-"));
  try {
    fs.copyFileSync(path.resolve(__dirname, "../custom-server.js"), path.join(dir, "custom-server.js"));
    fs.writeFileSync(path.join(dir, "server.js"), 'if (process.env.PORT !== "20130" || process.env.HOSTNAME !== "127.0.0.1") process.exit(2);');
    const run = (args) => spawnSync(process.execPath, [path.join(dir, "custom-server.js"), ...args], { encoding: "utf8" });
    assert.equal(run(["-p", "20130", "--host", "127.0.0.1"]).status, 0);
    for (const value of ["0", "65536", "20130abc", "-1"]) {
      assert.equal(run(["--port", value]).status, 1);
    }
    assert.equal(run(["--host"]).status, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
