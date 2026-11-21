import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Payments" };

// Placeholder — content arrives in Flow 8.
export default function PaymentsPage() {
  return (
    <>
      <PageHeader title="Payments" description="Monthly charges based on the hours attended." />
      <EmptyState title="Coming soon">Monthly payments will be listed here from the first completed month of the term.</EmptyState>
    </>
  );
}
