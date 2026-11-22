import Form from "next/form";
import { GOAL_LABELS } from "@/lib/students/labels";
import type { StudentFilters as Filters } from "@/lib/students/filters";
import { GOALS } from "@/lib/students/types";

/** Search by name + filter by goal and status. A plain GET form: works without JS and by keyboard. */
export function StudentFilters({ filters }: { filters: Filters }) {
  return (
    <Form action="/students" role="search" aria-label="Filter students" className="mb-4 grid gap-3 card p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
      <div className="space-y-1.5">
        <label htmlFor="q" className="block text-sm font-medium">Search by name</label>
        <input id="q" name="q" type="search" defaultValue={filters.q} placeholder="e.g. Ana" className="input" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="goal-filter" className="block text-sm font-medium">Goal</label>
        <select id="goal-filter" name="goal" defaultValue={filters.goal ?? ""} className="input">
          <option value="">All goals</option>
          {GOALS.map((g) => <option key={g} value={g}>{GOAL_LABELS[g]}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="status-filter" className="block text-sm font-medium">Status</label>
        <select id="status-filter" name="status" defaultValue={filters.status} className="input">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
      </div>
      <button type="submit" className="btn-secondary h-[42px]">Apply</button>
    </Form>
  );
}
