export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="rounded-xl border border-border bg-surface px-6 py-10 text-center text-sm text-muted">
      {label}
    </div>
  );
}
