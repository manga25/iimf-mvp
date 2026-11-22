import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PaymentSync } from "@/components/payments/PaymentSync";

// Authenticated area. Access is enforced by src/proxy.ts and re-checked in every
// Server Action / Route Handler via getAuthUser() / withAuth().
// <PaymentSync> runs the lazy payment generation on every page load (SPEC §3.7);
// pages that show payment data also await it themselves, since layouts are not
// re-rendered on client-side navigation.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell>
      <Suspense fallback={null}><PaymentSync /></Suspense>
      {children}
    </AppShell>
  );
}
