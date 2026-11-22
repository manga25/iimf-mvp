import Link from "next/link";
import { paymentsHref, type PaymentCounter } from "@/lib/dashboard/view";

type Props = { unpaid: PaymentCounter; overdue: PaymentCounter; approved: boolean };

/** (3) Unpaid / Overdue counters over every month of the term, linking to the Payments filter. */
export function PaymentCounters({ unpaid, overdue, approved }: Props) {
  const items = [
    { key: "unpaid" as const, label: "Unpaid", counter: unpaid, tone: "text-foreground" },
    { key: "overdue" as const, label: "Overdue", counter: overdue, tone: overdue.count > 0 ? "text-danger" : "text-foreground" },
  ];
  return (
    <section aria-labelledby="payments-title" className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <h2 id="payments-title" className="mb-3 text-base font-semibold">Payments</h2>
      <div className="grid grid-cols-2 gap-3">
        {items.map((i) => (
          <Link
            key={i.key}
            href={paymentsHref(i.key, i.counter)}
            aria-label={`${i.counter.count} ${i.label.toLowerCase()} payments — open Payments`}
            className="rounded-lg border border-border px-4 py-3 hover:bg-surface-muted"
          >
            <span className="block text-sm text-muted">{i.label}</span>
            <span className={`mt-1 block text-2xl font-semibold tabular-nums ${i.tone}`} data-testid={`count-${i.key}`}>
              {i.counter.count}
            </span>
          </Link>
        ))}
      </div>
      {!approved && (
        <p className="mt-3 text-sm text-muted">Charges are created from attendance once the schedule is approved.</p>
      )}
    </section>
  );
}
