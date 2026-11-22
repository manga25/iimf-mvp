import { formatAmount, formatMonth } from "@/lib/payments/months";

/** Month totals: expected (every charge) and received (paid charges). */
export function PaymentTotals({ month, expected, received }: { month: string; expected: number; received: number }) {
  const items = [
    { label: "Expected", value: expected, testId: "total-expected" },
    { label: "Received", value: received, testId: "total-received" },
    { label: "Outstanding", value: Math.round((expected - received) * 100) / 100, testId: "total-outstanding" },
  ];
  return (
    <section aria-label={`Totals for ${formatMonth(month)}`} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.label} className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-muted">{i.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums" data-testid={i.testId}>{formatAmount(i.value)} €</p>
        </div>
      ))}
    </section>
  );
}
