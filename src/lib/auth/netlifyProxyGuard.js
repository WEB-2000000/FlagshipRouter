import { NextResponse } from "next/server";
import { authorize } from "./authorizationTransport.mjs";

export async function isAuthenticated(request) {
  try { return (await authorize(request, "session")).authenticated; }
  catch { return false; }
}

export async function proxy(request) {
  // Public entry points must remain reachable even if auth storage is down.
  // Each auth route performs its own validation in the Node handler.
  const pathname = request.nextUrl.pathname;
  const publicPaths = ["/login", "/api/health", "/api/init", "/api/locale", "/api/auth/login", "/api/auth/logout", "/api/auth/status", "/api/version", "/api/settings/require-login"];
  if (publicPaths.includes(pathname) || pathname.startsWith("/api/auth/oidc/") || pathname.startsWith("/api/auth/saml/")) {
    return NextResponse.next();
  }
  try {
    const result = await authorize(request, "guard");
    if (result.action === "next") return NextResponse.next();
    if (result.action === "redirect") {
      const location = new URL(result.location, request.url);
      if (location.origin !== new URL(request.url).origin) throw new Error("Invalid redirect");
      return NextResponse.redirect(location);
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: result.status === 403 ? 403 : 401 });
  } catch {
    return NextResponse.json({ error: "Authorization service unavailable" }, { status: 503 });
  }
}
