import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Notifications" };

// Placeholder — content arrives in Flow 9.
export default function NotificationsPage() {
  return (
    <>
      <PageHeader title="Notifications" description="WhatsApp messages ready to copy or send." />
      <EmptyState title="Coming soon">Messages about absences, overdue payments, cancellations and modality changes will appear here.</EmptyState>
    </>
  );
}
