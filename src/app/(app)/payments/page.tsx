import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PaymentFilters } from "@/components/payments/PaymentFilters";
import { PaymentList } from "@/components/payments/PaymentList";
import { PaymentTotals } from "@/components/payments/PaymentTotals";
import { EmptyState } from "@/components/ui/EmptyState";
import { Loading } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatLongDate, lisbonToday } from "@/lib/calendar/dates";
import { addMonths, completedTermMonths, firstOfMonth, filterPayments, formatMonth, monthTotals, overdueFrom, parseMonthParam } from "@/lib/payments/months";
import { getApprovedTerm, listPayments } from "@/lib/payments/repository";
import { ensurePayments } from "@/lib/payments/sync";
import { STATUS_FILTERS, type StatusFilter } from "@/lib/payments/types";

export const metadata: Metadata = { title: "Payments" };

async function PaymentsContent({ searchParams }: Pick<PageProps<"/payments">, "searchParams">) {
  await connection(); // "today" is request-time data
  await ensurePayments(); // shared with the layout's sync in the same request
  const today = lisbonToday();
  const term = await getApprovedTerm();
  if (!term) {
    return (
      <EmptyState title="No payments yet">
        Payments are created from attendance once the schedule is approved. Approve it on the Schedule page first.
      </EmptyState>
    );
  }

  const months = completedTermMonths(term, today);
  if (months.length === 0) {
    const first = firstOfMonth(term.term_start);
    return (
      <EmptyState title="No completed month yet">
        The {formatMonth(first)} charges will appear here on 1 {formatMonth(addMonths(first, 1))}.
      </EmptyState>
    );
  }

  const params = await searchParams;
  const requested = parseMonthParam(params.month);
  const month = requested && months.includes(requested) ? requested : months[0];
  const status = STATUS_FILTERS.includes(params.status as StatusFilter) ? (params.status as StatusFilter) : "all";

  const payments = await listPayments(month);
  const { expected, received } = monthTotals(payments);

  return (
    <>
      <PaymentFilters months={months} month={month} status={status} />
      <PaymentTotals month={month} expected={expected} received={received} />
      <p className="mb-4 text-sm text-muted">
        {formatMonth(month)} charges cover the classes attended that month. Unpaid charges become overdue on{" "}
        {formatLongDate(overdueFrom(month))}.
      </p>
      <PaymentList payments={filterPayments(payments, status, today)} today={today} filtered={status !== "all"} />
    </>
  );
}

export default function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  return (
    <>
      <PageHeader title="Payments" description="Monthly charges based on the hours attended in the previous month." />
      <Suspense fallback={<Loading label="Loading payments…" />}>
        <PaymentsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
