// Middleware-safe: database and filesystem dependencies live in the Node route.
export const PROXY_AUTH_PATH = "/api/auth/proxy-check";

const contexts = new WeakMap();
const denied = Object.freeze({
  tokenAuthenticated: false,
  cliAuthenticated: false,
  apiKeyAuthenticated: false,
  settings: null,
});

export function getProxyAuthContext(request) {
  if (!contexts.has(request)) contexts.set(request, loadContext(request));
  return contexts.get(request);
}

async function loadContext(request) {
  try {
    const url = new URL(PROXY_AUTH_PATH, request.url);
    const headers = new Headers();
    // Forward credentials only, never middleware bypass or client auth-result headers.
    for (const name of ["cookie", "authorization", "x-api-key", "x-goog-api-key", "x-fr-cli-token"]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const key = request.nextUrl.searchParams.get("key");
    if (key) headers.set("x-fr-query-api-key", key);
    const response = await fetch(url, {
      method: "POST",
      headers,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return denied;
    return await response.json();
  } catch {
    // An unavailable auth backend must never authorize a request.
    return denied;
  }
}
