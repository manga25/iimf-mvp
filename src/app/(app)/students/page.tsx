import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Loading } from "@/components/ui/Loading";
import { ReadOnlyBanner } from "@/components/students/ReadOnlyBanner";
import { StudentFilters } from "@/components/students/StudentFilters";
import { StudentList } from "@/components/students/StudentList";
import { parseFilters } from "@/lib/students/filters";
import { isScheduleApproved, listStudents } from "@/lib/students/repository";

export const metadata: Metadata = { title: "Students" };

async function AddStudentAction() {
  if (await isScheduleApproved()) return null;
  return <Link href="/students/new" className="btn-primary">Add student</Link>;
}

async function StudentsContent({ searchParams }: Pick<PageProps<"/students">, "searchParams">) {
  const filters = parseFilters(await searchParams);
  const [students, locked] = await Promise.all([listStudents(filters), isScheduleApproved()]);
  const filtered = Boolean(filters.q || filters.goal || filters.status !== "active");

  return (
    <>
      {locked && <ReadOnlyBanner />}
      <StudentFilters filters={filters} />
      <StudentList students={students} filtered={filtered} />
    </>
  );
}

export default function StudentsPage({ searchParams }: PageProps<"/students">) {
  return (
    <>
      <PageHeader
        title="Students"
        description="Create and manage students and their weekly availability."
        actions={<Suspense fallback={null}><AddStudentAction /></Suspense>}
      />
      <Suspense fallback={<Loading label="Loading students…" />}>
        <StudentsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
