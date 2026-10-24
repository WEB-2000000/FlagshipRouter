import { DashboardLayout } from "@/shared/components";
import { ensureOutboundProxyInitialized } from "@/lib/network/initOutboundProxy";

// Account-specific pages read managed storage after deploy migrations, never
// while Next.js prerenders a fresh database branch during the build.
export const dynamic = "force-dynamic";

export default async function DashboardRootLayout({ children }) {
  await ensureOutboundProxyInitialized();
  return <DashboardLayout>{children}</DashboardLayout>;
}

