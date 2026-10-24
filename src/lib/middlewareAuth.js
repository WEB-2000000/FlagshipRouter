import { NextResponse } from "next/server";

export const AUTH_DECISION_PATH = "/api/internal/middleware-auth";
const decisions = new WeakMap();

// Keep this module free of server auth imports: it is bundled into middleware.
function getDecision(request) {
  if (!decisions.has(request)) {
    decisions.set(request, (async () => {
      const url = new URL(AUTH_DECISION_PATH, request.url);
      const original = new URL(request.url);
      url.searchParams.set("path", original.pathname + original.search);
      const headers = new Headers();
      for (const name of [
        "cookie", "authorization", "x-api-key", "x-goog-api-key", "origin",
        "host", "x-fr-cli-token", "x-fr-peer-token", "x-fr-real-ip", "x-fr-via-proxy",
      ]) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
      }
      try {
        const response = await fetch(url, {
          headers, cache: "no-store", redirect: "error",
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error("Authorization check failed");
        const decision = await response.json();
        if (typeof decision.allow !== "boolean" || typeof decision.authenticated !== "boolean") {
          throw new Error("Invalid authorization decision");
        }
        return decision;
      } catch {
        // An unavailable auth service must never grant access.
        return { allow: false, authenticated: false, status: 503, error: "Authorization service unavailable" };
      }
    })());
  }
  return decisions.get(request);
}

export async function isAuthenticated(request) {
  return (await getDecision(request)).authenticated;
}

export async function proxy(request) {
  const decision = await getDecision(request);
  if (decision.allow) return NextResponse.next();
  if (decision.location) return NextResponse.redirect(new URL(decision.location, request.url));
  return NextResponse.json({ error: decision.error }, { status: decision.status });
}
