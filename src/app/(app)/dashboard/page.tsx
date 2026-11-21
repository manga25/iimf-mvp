import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Dashboard" };

// Placeholder — content arrives in Flow 10.
export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Today's classes, upcoming week, payments and alerts." />
      <EmptyState title="Nothing to show yet">
        Start by adding your students. Once the schedule is approved, today&apos;s classes and alerts will appear here.
      </EmptyState>
    </>
  );
}
