import type { ApprovalSummary } from "@/lib/schedule/summary";

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));

/** After approval: explains that the schedule is frozen for the term. */
export function ApprovedBanner({ termStart, termEnd }: { termStart: string; termEnd: string }) {
  return (
    <div role="status" className="rounded-lg border border-success/25 bg-success-soft px-4 py-3 text-sm text-success">
      <p className="font-semibold">Schedule approved</p>
      <p className="mt-0.5">
        Classes run every week from {formatDate(termStart)} to {formatDate(termEnd)}. The schedule and students are
        read-only for the rest of the term.
      </p>
    </div>
  );
}

/** Draft: counts of errors (block approval) and warnings (allowed). */
export function DraftStatus({ summary }: { summary: ApprovalSummary }) {
  const { errors, warnings } = summary;
  const tone = errors > 0 ? "border-danger/30 bg-danger-soft text-danger" : warnings.length > 0
    ? "border-warning/25 bg-warning-soft text-warning" : "border-success/25 bg-success-soft text-success";
  return (
    <div role="status" data-testid="draft-status" className={`rounded-lg border px-4 py-3 text-sm ${tone}`}>
      <p className="font-semibold">
        Draft · {summary.classes} class{summary.classes === 1 ? "" : "es"} · {summary.allocated} allocated · {summary.unallocated} unallocated
      </p>
      <p className="mt-0.5">
        {errors > 0 ? `${errors} error${errors === 1 ? "" : "s"} must be fixed before approval. ` : "No errors. "}
        {warnings.length > 0 ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"} (allowed).` : "No warnings."}
      </p>
    </div>
  );
}
