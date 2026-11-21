import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Attendance" };

// Placeholder — content arrives in Flow 6.
export default function AttendancePage() {
  return (
    <>
      <PageHeader title="Attendance" description="Weekly calendar, attendance, blocked periods and session changes." />
      <EmptyState title="Coming soon">After the schedule is approved, the calendar of sessions will appear here.</EmptyState>
    </>
  );
}
