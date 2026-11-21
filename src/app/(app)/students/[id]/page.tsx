import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Loading } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { AvailabilitySummary } from "@/components/students/AvailabilitySummary";
import { DeactivateButton } from "@/components/students/DeactivateButton";
import { ReadOnlyBanner } from "@/components/students/ReadOnlyBanner";
import { goalDetail } from "@/lib/students/labels";
import { getStudent, isScheduleApproved } from "@/lib/students/repository";
import { isUuid } from "@/lib/students/types";

export const metadata: Metadata = { title: "Student" };

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-6">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="w-32 shrink-0 text-sm text-muted">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

async function StudentDetail({ params }: Pick<PageProps<"/students/[id]">, "params">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [student, locked] = await Promise.all([getStudent(id), isScheduleApproved()]);
  if (!student) notFound();
  const editable = !locked;

  return (
    <>
      <PageHeader
        title={student.full_name}
        actions={editable && (
          <>
            <Link href={`/students/${student.id}/edit`} className="btn-secondary">Edit</Link>
            {student.is_active && <DeactivateButton studentId={student.id} name={student.full_name} />}
          </>
        )}
      />
      {locked && <ReadOnlyBanner />}
      <div className="mb-4 flex flex-wrap gap-2">
        {student.is_active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
        <Badge tone="primary">{goalDetail(student)}</Badge>
      </div>
      <div className="space-y-4">
        <Card title="Contact">
          <dl className="divide-y divide-border">
            <Detail label="Phone">{student.phone}</Detail>
            <Detail label="Guardian">
              {student.guardian_name ? `${student.guardian_name} · ${student.guardian_phone}` : <span className="text-muted">None</span>}
            </Detail>
          </dl>
        </Card>
        <Card title="Weekly availability">
          <AvailabilitySummary blocks={student.availability} />
        </Card>
      </div>
    </>
  );
}

export default function StudentPage({ params }: PageProps<"/students/[id]">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/students" className="mb-4 inline-block text-sm font-medium text-primary hover:underline">← All students</Link>
      <Suspense fallback={<Loading label="Loading student…" />}>
        <StudentDetail params={params} />
      </Suspense>
    </div>
  );
}
