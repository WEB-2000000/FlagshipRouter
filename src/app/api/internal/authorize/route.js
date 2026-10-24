import { NextRequest, NextResponse } from "next/server";
import { proxy, isAuthenticated } from "@/dashboardGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public decision endpoint: it performs the same credential checks as the
// guard and returns no settings, keys, session claims, or protected content.
export async function POST(request) {
  try {
    const input = await request.json();
    if (!["guard", "session"].includes(input.action) || typeof input.path !== "string" ||
        !input.path.startsWith("/") || input.path.startsWith("//") || input.path.length > 8192) {
      return NextResponse.json({ error: "Invalid authorization request" }, { status: 400 });
    }
    const target = new URL(input.path, request.url);
    if (target.origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Invalid authorization request" }, { status: 400 });
    }
    const headers = new Headers(request.headers);
    // This is a remote Netlify request, never a trusted local CLI socket.
    for (const name of ["x-fr-peer-token", "x-fr-real-ip", "x-fr-via-proxy"]) headers.delete(name);
    const original = new NextRequest(target, { headers });
    const options = { headers: { "Cache-Control": "no-store" } };
    if (input.action === "session") {
      return NextResponse.json({ authenticated: await isAuthenticated(original) }, options);
    }
    const decision = await proxy(original);
    if (decision.headers.get("x-middleware-next") === "1") {
      return NextResponse.json({ action: "next" }, options);
    }
    const location = decision.headers.get("location");
    if (location) {
      const destination = new URL(location, target);
      if (destination.origin !== target.origin) throw new Error("Invalid redirect");
      // Node's internal origin can differ from the public Edge origin.
      return NextResponse.json({ action: "redirect", location: destination.pathname + destination.search }, options);
    }
    return NextResponse.json({ action: "deny", status: decision.status === 403 ? 403 : 401 }, options);
  } catch {
    return NextResponse.json({ error: "Authorization service unavailable" }, { status: 503 });
  }
}
