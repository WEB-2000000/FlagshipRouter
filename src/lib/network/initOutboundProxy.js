import { getSettings } from "@/lib/localDb";
import { applyOutboundProxyEnv } from "@/lib/network/outboundProxy";

let initialized = false;

export async function ensureOutboundProxyInitialized() {
  if (initialized) return true;

  try {
    const settings = await getSettings();
    applyOutboundProxyEnv(settings);
    initialized = true;
  } catch {
    console.error("[ServerInit] Outbound proxy settings are temporarily unavailable");
  }

  return initialized;
}

// Called explicitly from the dynamic dashboard layout. Importing a module
// during build or route collection must never open application storage.

export default ensureOutboundProxyInitialized;
