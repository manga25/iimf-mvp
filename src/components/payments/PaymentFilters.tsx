import Form from "next/form";
import { formatMonth } from "@/lib/payments/months";
import { STATUS_FILTERS, STATUS_LABELS, type StatusFilter } from "@/lib/payments/types";

/** Month selector + status filter. A plain GET form: works without JS and by keyboard. */
export function PaymentFilters({ months, month, status }: { months: string[]; month: string; status: StatusFilter }) {
  return (
    <Form action="/payments" role="search" aria-label="Filter payments" className="mb-4 grid gap-3 card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div className="space-y-1.5">
        <label htmlFor="month-filter" className="block text-sm font-medium">Month</label>
        <select id="month-filter" name="month" defaultValue={month.slice(0, 7)} className="input">
          {months.map((m) => <option key={m} value={m.slice(0, 7)}>{formatMonth(m)}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="payment-status-filter" className="block text-sm font-medium">Status</label>
        <select id="payment-status-filter" name="status" defaultValue={status} className="input">
          {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s === "all" ? "All" : STATUS_LABELS[s]}</option>)}
        </select>
      </div>
      <button type="submit" className="btn-secondary h-[42px]">Apply</button>
    </Form>
  );
}
