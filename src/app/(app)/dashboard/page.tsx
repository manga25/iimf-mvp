import type { Metadata } from "next";
import { logout } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Dashboard" };

// Placeholder — content arrives in Flow 10. The sidebar layout arrives in Flow 1 step 4.
export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <form action={logout}>
          <button type="submit" className="btn-secondary">Log out</button>
        </form>
      </div>
      <p className="mt-4 text-muted">You are logged in.</p>
    </main>
  );
}
