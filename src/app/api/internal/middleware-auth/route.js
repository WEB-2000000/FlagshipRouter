import { NextRequest, NextResponse } from "next/server";
import { proxy, isAuthenticated } from "@/dashboardGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This endpoint only evaluates access. It never executes the requested operation
// or returns settings, session tokens, or other database contents.
export async function GET(request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const path = request.nextUrl.searchParams.get("path");
    const target = new URL(path || "/", request.url);
    if (!path?.startsWith("/") || target.origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400, headers });
    }
    const original = new NextRequest(target, { headers: request.headers });
    const response = await proxy(original);
    const authenticated = (request.headers.get("cookie") || "").includes("9r_mimo_login=")
      ? await isAuthenticated(original)
      : false;
    const allow = response.headers.get("x-middleware-next") === "1";
    const location = response.headers.get("location");
    const error = !allow && !location ? (await response.json()).error : undefined;
    return NextResponse.json({ allow, authenticated, status: response.status, location, error }, { headers });
  } catch {
    return NextResponse.json({ error: "Authorization service unavailable" }, { status: 503, headers });
  }
}
