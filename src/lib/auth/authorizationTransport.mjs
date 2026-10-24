export async function authorize(request, action, fetcher = fetch) {
  const endpoint = new URL("/api/internal/authorize", request.url);
  const headers = new Headers({ "content-type": "application/json" });
  // Only forward credentials required by the existing guard. Do not forward
  // caller-controlled transport headers or filesystem/peer-trust assertions.
  for (const name of ["cookie", "authorization", "x-api-key", "x-goog-api-key", "x-fr-cli-token", "origin"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const response = await fetcher(endpoint, {
    method: "POST", headers,
    body: JSON.stringify({ action, path: request.nextUrl.pathname + request.nextUrl.search }),
    redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Authorization check unavailable");
  const result = await response.json();
  if (action === "session") {
    if (typeof result.authenticated !== "boolean") throw new Error("Invalid authorization response");
  } else if (!["next", "redirect", "deny"].includes(result.action)) {
    throw new Error("Invalid authorization response");
  }
  return result;
}
