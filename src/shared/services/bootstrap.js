import { isNetlifyRuntime } from "@/lib/runtime.js";
// Skip during Next.js build/prerender — bootstrap would download cloudflared, init DNS, etc.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build"
  || process.env.NEXT_PHASE === "phase-export"
  || process.env.NEXT_PHASE === "phase-static";

// Server-only singleton: guard via global so HMR / re-imports don't double-init
if (typeof window === "undefined" && !isNetlifyRuntime && !isBuildPhase && !global.__appBootstrapped) {
  global.__appBootstrapped = true;
  import("./initializeApp.js").then(({ default: initializeApp }) => initializeApp())
    .catch(() => console.error("[Bootstrap] initialization failed"));
}
