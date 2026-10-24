// Local servers keep direct access; Netlify replaces this boundary at build time.
export { proxy, isAuthenticated } from "../../dashboardGuard";
