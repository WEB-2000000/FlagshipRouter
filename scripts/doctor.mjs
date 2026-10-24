#!/usr/bin/env node
// Print only status codes and fixed advice; upstream bodies may contain secrets.
const args = process.argv.slice(2);
let port = "20130";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" || args[i] === "-p") port = args[++i];
  else {
    console.error("Usage: npm run doctor -- --port 20130");
    process.exit(1);
  }
}
if (!/^\d+$/.test(port || "") || Number(port) < 1 || Number(port) > 65535) {
  console.error("Port must be an integer between 1 and 65535.");
  process.exit(1);
}

let failed = false;
for (const [label, route] of [["Application", "/api/health"], ["Dashboard authorization", "/api/auth/status"]]) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, {
      signal: AbortSignal.timeout(10000), redirect: "manual",
    });
    const data = response.ok ? await response.json().catch(() => null) : null;
    const valid = response.ok && (route === "/api/health" ? data?.ok === true : typeof data?.authenticated === "boolean");
    console.log(`${label}: ${valid ? "OK" : "FAILED"} (HTTP ${response.status})`);
    if (!valid) failed = true;
    await response.body?.cancel().catch(() => {});
  } catch {
    failed = true;
    console.log(`${label}: unavailable or timed out.`);
  }
}
if (failed) {
  console.log("Check service status and local logs. A 502/503 may come from a proxy or an upstream authorization service; changing the port does not repair provider credentials.");
} else {
  console.log("Local endpoints respond. Test the affected model in the dashboard to check its provider authorization separately.");
}
process.exitCode = failed ? 1 : 0;
