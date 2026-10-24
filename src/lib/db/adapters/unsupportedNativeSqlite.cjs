// Build-time replacement for Netlify's Node middleware, which cannot load
// third-party C++ addons. The existing driver fallback handles this error.
module.exports = class UnsupportedNativeSqlite {
  constructor() {
    throw new Error("Native SQLite addons are unavailable on Netlify; selecting a supported SQLite driver.");
  }
};
