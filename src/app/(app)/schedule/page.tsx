import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Schedule" };

// Placeholder — content arrives in Flow 5.
export default function SchedulePage() {
  return (
    <>
      <PageHeader title="Schedule" description="Generate, review and approve the weekly class schedule." />
      <EmptyState title="Coming soon">Once every student has availability, you will generate and approve the schedule here.</EmptyState>
    </>
  );
}
