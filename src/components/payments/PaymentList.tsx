import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatShortDate } from "@/lib/calendar/dates";
import { displayStatus, formatAmount, formatHours } from "@/lib/payments/months";
import { STATUS_LABELS, type Payment, type PaymentDisplayStatus } from "@/lib/payments/types";
import { GOAL_LABELS } from "@/lib/students/labels";
import { PaymentAction } from "./PaymentAction";

const TONES = { paid: "success", unpaid: "neutral", overdue: "danger" } as const;
const StatusBadge = ({ status }: { status: PaymentDisplayStatus }) => <Badge tone={TONES[status]}>{STATUS_LABELS[status]}</Badge>;

const paidDate = (p: Payment) => (p.paid_at ? formatShortDate(p.paid_at) : "—");

/** Table on desktop, cards on mobile (SPEC §5). */
export function PaymentList({ payments, today, filtered }: { payments: Payment[]; today: string; filtered: boolean }) {
  if (payments.length === 0) {
    return filtered ? (
      <EmptyState title="No payments match this filter">Set Status to “All” to see every payment of this month.</EmptyState>
    ) : (
      <EmptyState title="No charges this month">No student attended a class in this month, so there is nothing to bill.</EmptyState>
    );
  }

  return (
    <>
      <p className="mb-2 text-sm text-muted" aria-live="polite">
        {payments.length} {payments.length === 1 ? "payment" : "payments"}
      </p>

      <ul className="space-y-3 md:hidden" aria-label="Payments">
        {payments.map((p) => (
          <li key={p.id} className="card card-hover p-4" data-testid="payment-row">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{p.student_name}</p>
                <p className="text-sm text-muted">{GOAL_LABELS[p.goal]}</p>
              </div>
              <StatusBadge status={displayStatus(p, today)} />
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div><dt className="text-muted">Hours</dt><dd className="tabular-nums">{formatHours(p.hours)}</dd></div>
              <div><dt className="text-muted">Amount</dt><dd className="font-medium tabular-nums">{formatAmount(p.amount)} €</dd></div>
              <div><dt className="text-muted">Paid on</dt><dd>{paidDate(p)}</dd></div>
            </dl>
            <div className="mt-3"><PaymentAction payment={p} today={today} /></div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto card md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Payments</caption>
          <thead className="border-b border-border bg-slate-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Student</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Hours</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Amount</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              <th scope="col" className="px-4 py-3 font-semibold">Paid on</th>
              <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payments.map((p) => (
              <tr key={p.id} data-testid="payment-row" className="transition-colors hover:bg-primary-soft/50">
                <th scope="row" className="px-4 py-3 font-medium">
                  {p.student_name}
                  <span className="block text-xs font-normal text-muted">{GOAL_LABELS[p.goal]}</span>
                </th>
                <td className="px-4 py-3 text-right tabular-nums">{formatHours(p.hours)}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{formatAmount(p.amount)} €</td>
                <td className="px-4 py-3"><StatusBadge status={displayStatus(p, today)} /></td>
                <td className="px-4 py-3">{paidDate(p)}</td>
                <td className="px-4 py-3 text-right"><PaymentAction payment={p} today={today} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
