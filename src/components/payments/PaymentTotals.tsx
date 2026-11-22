import { formatAmount, formatMonth } from "@/lib/payments/months";

/** Month totals: expected (every charge) and received (paid charges). */
export function PaymentTotals({ month, expected, received }: { month: string; expected: number; received: number }) {
  const items = [
    { label: "Expected", value: expected, testId: "total-expected", accent: "border-t-primary" },
    { label: "Received", value: received, testId: "total-received", accent: "border-t-success" },
    { label: "Outstanding", value: Math.round((expected - received) * 100) / 100, testId: "total-outstanding", accent: "border-t-goal-individual" },
  ];
  return (
    <section aria-label={`Totals for ${formatMonth(month)}`} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.label} className={`card border-t-[3px] p-4 ${i.accent}`}>
          <p className="text-sm text-muted">{i.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums" data-testid={i.testId}>{formatAmount(i.value)} €</p>
        </div>
      ))}
    </section>
  );
}
