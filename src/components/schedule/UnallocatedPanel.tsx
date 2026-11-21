import { compatibleGroups, type GroupView, type UnallocatedView } from "@/lib/schedule/view";
import { UnallocatedRow } from "./UnallocatedRow";

/** SPEC §5: Unallocated students panel with reasons. */
export function UnallocatedPanel({ students, groups, editable }: { students: UnallocatedView[]; groups: GroupView[]; editable: boolean }) {
  return (
    <section aria-labelledby="unallocated-title" className="rounded-xl border border-border bg-surface p-4">
      <h2 id="unallocated-title" className="text-base font-semibold">
        Unallocated students <span className="font-normal text-muted">({students.length})</span>
      </h2>
      {students.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Every active student has a class.</p>
      ) : (
        <ul className="mt-1 divide-y divide-border">
          {students.map((s) => (
            <UnallocatedRow key={s.id} student={s} targets={compatibleGroups(groups, s)} editable={editable} />
          ))}
        </ul>
      )}
    </section>
  );
}
