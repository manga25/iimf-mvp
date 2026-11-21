import { AppShell } from "@/components/layout/AppShell";

// Authenticated area. Access is enforced by src/proxy.ts and re-checked in every
// Server Action / Route Handler via getAuthUser() / withAuth().
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
