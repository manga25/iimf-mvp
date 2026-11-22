import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { totalMinutes } from "@/lib/students/availability";
import { formatHours, goalDetail } from "@/lib/students/labels";
import type { Student } from "@/lib/students/types";

function AvailabilityBadge({ student }: { student: Student }) {
  const minutes = totalMinutes(student.availability);
  return minutes > 0 ? <span className="text-sm">{formatHours(minutes)} / week</span> : <Badge tone="warning">No availability</Badge>;
}

const StatusBadge = ({ active }: { active: boolean }) =>
  active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>;

/** Table on desktop, cards on mobile (SPEC §5). */
export function StudentList({ students, filtered }: { students: Student[]; filtered: boolean }) {
  if (students.length === 0) {
    return filtered ? (
      <EmptyState title="No students match these filters">Try another name, or set Goal and Status to “All”.</EmptyState>
    ) : (
      <EmptyState title="No students yet">Add your first student with “Add student”. You can set their goal and weekly availability.</EmptyState>
    );
  }

  return (
    <>
      <p className="mb-2 text-sm text-muted" aria-live="polite">
        {students.length} {students.length === 1 ? "student" : "students"}
      </p>

      <ul className="space-y-3 md:hidden" aria-label="Students">
        {students.map((s) => (
          <li key={s.id} className="card card-hover p-4">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/students/${s.id}`} className="font-semibold text-primary hover:underline">{s.full_name}</Link>
              <StatusBadge active={s.is_active} />
            </div>
            <p className="mt-1 text-sm">{goalDetail(s)}</p>
            <div className="mt-2 flex items-center justify-between gap-3 text-sm text-muted">
              <span>{s.phone}</span>
              <AvailabilityBadge student={s} />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden card md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Students</caption>
          <thead className="border-b border-border bg-slate-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Name</th>
              <th scope="col" className="px-4 py-3 font-semibold">Goal</th>
              <th scope="col" className="px-4 py-3 font-semibold">Phone</th>
              <th scope="col" className="px-4 py-3 font-semibold">Guardian</th>
              <th scope="col" className="px-4 py-3 font-semibold">Availability</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {students.map((s) => (
              <tr key={s.id} className="transition-colors hover:bg-primary-soft/50">
                <td className="px-4 py-3">
                  <Link href={`/students/${s.id}`} className="font-medium text-primary hover:underline">{s.full_name}</Link>
                </td>
                <td className="px-4 py-3">{goalDetail(s)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{s.phone}</td>
                <td className="px-4 py-3">{s.guardian_name ?? <span className="text-muted">—</span>}</td>
                <td className="px-4 py-3"><AvailabilityBadge student={s} /></td>
                <td className="px-4 py-3"><StatusBadge active={s.is_active} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
