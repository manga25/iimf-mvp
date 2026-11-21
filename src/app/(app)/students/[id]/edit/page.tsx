import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReadOnlyBanner } from "@/components/students/ReadOnlyBanner";
import { StudentForm } from "@/components/students/StudentForm";
import { getStudent, isScheduleApproved } from "@/lib/students/repository";
import { isUuid } from "@/lib/students/types";

export const metadata: Metadata = { title: "Edit student" };

async function EditStudentContent({ params }: Pick<PageProps<"/students/[id]/edit">, "params">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [student, locked] = await Promise.all([getStudent(id), isScheduleApproved()]);
  if (!student) notFound();

  return (
    <>
      <PageHeader title={`Edit ${student.full_name}`} description="Update the student’s details, goal and weekly availability." />
      {locked ? (
        <>
          <ReadOnlyBanner />
          <Link href={`/students/${student.id}`} className="btn-secondary">Back to student</Link>
        </>
      ) : (
        <StudentForm student={student} />
      )}
    </>
  );
}

export default function EditStudentPage({ params }: PageProps<"/students/[id]/edit">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<Loading />}>
        <EditStudentContent params={params} />
      </Suspense>
    </div>
  );
}
