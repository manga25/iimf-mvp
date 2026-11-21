import Link from "next/link";

/** AC-3.1: students without availability block generation; each links to their edit page. */
export function ValidationPanel({ students }: { students: { id: string; full_name: string }[] }) {
  if (students.length === 0) return null;
  return (
    <section aria-labelledby="validation-title" className="rounded-xl border border-danger/30 bg-danger-soft p-4 sm:p-5">
      <h2 id="validation-title" className="text-base font-semibold text-danger">
        {students.length === 1 ? "1 student has" : `${students.length} students have`} no availability
      </h2>
      <p className="mt-1 text-sm text-danger">
        The schedule can&apos;t be generated until every active student has at least one available time block.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2" data-testid="missing-availability">
        {students.map((s) => (
          <li key={s.id}>
            <Link
              href={`/students/${s.id}/edit`}
              className="inline-flex rounded-md border border-danger/30 bg-surface px-3 py-1.5 text-sm font-medium text-danger underline-offset-2 hover:underline"
            >
              {s.full_name} — add availability
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
