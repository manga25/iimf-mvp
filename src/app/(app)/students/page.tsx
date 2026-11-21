import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Students" };

// Placeholder — content arrives in Flow 2.
export default function StudentsPage() {
  return (
    <>
      <PageHeader title="Students" description="Create and manage students and their weekly availability." />
      <EmptyState title="Coming soon">This is where you will add students, set their goal and weekly availability.</EmptyState>
    </>
  );
}
