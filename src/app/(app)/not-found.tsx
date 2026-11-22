import Link from "next/link";

// 404 inside the app layout (sidebar stays visible). Shown for unknown URLs via
// (app)/[...missing]/page.tsx and for notFound() calls, e.g. a student id that doesn't exist.
export default function NotFound() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <p className="text-sm font-medium text-muted">Error 404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        This page doesn’t exist or was removed. Check the address, or use the menu to choose a section.
      </p>
      <Link href="/dashboard" className="btn-primary mt-6 inline-flex">Go to the Dashboard</Link>
    </div>
  );
}
