// The public build marker survives deployment even when NETLIFY itself is only
// present during the build. It contains no credentials or deployment secrets.
export const isNetlifyRuntime = process.env.FLAGSHIPROUTER_HOSTING_RUNTIME === "netlify"
  || process.env.NETLIFY === "true";
