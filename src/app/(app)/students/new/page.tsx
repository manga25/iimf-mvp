import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Loading } from "@/components/ui/Loading";
import { ReadOnlyBanner } from "@/components/students/ReadOnlyBanner";
import { StudentForm } from "@/components/students/StudentForm";
import { isScheduleApproved } from "@/lib/students/repository";

export const metadata: Metadata = { title: "Add student" };

async function NewStudentContent() {
  if (await isScheduleApproved()) {
    return (
      <>
        <ReadOnlyBanner />
        <Link href="/students" className="btn-secondary">Back to students</Link>
      </>
    );
  }
  return <StudentForm />;
}

export default function NewStudentPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add student" description="Enter the student’s details, goal and weekly availability." />
      <Suspense fallback={<Loading />}>
        <NewStudentContent />
      </Suspense>
    </div>
  );
}
