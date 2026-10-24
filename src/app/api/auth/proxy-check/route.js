import { getSettings, validateApiKey } from "@/lib/localDb";
import { verifyDashboardAuthToken } from "@/lib/auth/dashboardSession";
import { getConsistentMachineId } from "@/shared/utils/machineId";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public credential introspection: returns decisions only, never keys, hashes,
// session claims, or complete settings. The middleware always computes locality
// from the original request, not from this server-to-server request.
export async function POST(request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const auth = request.headers.get("authorization");
    const key = auth?.startsWith("Bearer ") ? auth.slice(7)
      : request.headers.get("x-api-key") || request.headers.get("x-goog-api-key")
        || request.headers.get("x-fr-query-api-key");
    const cliToken = request.headers.get("x-fr-cli-token");
    const [settings, tokenAuthenticated, cliAuthenticated, apiKeyAuthenticated] = await Promise.all([
      getSettings(),
      verifyDashboardAuthToken(request.cookies.get("auth_token")?.value),
      cliToken ? getConsistentMachineId("fr-cli-auth").then((token) => token === cliToken) : false,
      key ? validateApiKey(key) : false,
    ]);
    return Response.json({
      tokenAuthenticated,
      cliAuthenticated,
      apiKeyAuthenticated,
      settings: settings ? {
        requireLogin: settings.requireLogin !== false,
        tunnelDashboardAccess: settings.tunnelDashboardAccess === true,
        tunnelUrl: settings.tunnelUrl ? new URL(settings.tunnelUrl).origin : "",
        tailscaleUrl: settings.tailscaleUrl ? new URL(settings.tailscaleUrl).origin : "",
      } : null,
    }, { headers });
  } catch {
    return Response.json({ error: "Authentication unavailable" }, { status: 503, headers });
  }
}
