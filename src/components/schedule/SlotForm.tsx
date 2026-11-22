"use client";

import { useId, useState } from "react";
import { WEEKDAY_LABELS } from "@/lib/students/labels";
import { endTime } from "./goalStyles";
import { InlineAlert } from "./InlineAlert";
import { useScheduleAction } from "./useScheduleAction";

/** Start times on the 30-min grid where a class of this length fits in 08:00–20:00 (H1). */
const startTimes = (duration: number) =>
  Array.from({ length: (12 * 60 - duration) / 30 + 1 }, (_, i) => endTime("08:00", i * 30));

type Props = {
  duration: number;
  initial: { weekday: number; start_time: string };
  submitLabel: string;
  /** Accessible name of the submit button, when the visible label alone is ambiguous. */
  ariaLabel?: string;
  /** Disable submitting until the day/time differs from `initial`. */
  requireChange?: boolean;
  body: (weekday: number, start_time: string) => object;
};

/** Day + start time pickers that POST a schedule edit. The server validates overlaps and availability. */
export function SlotForm({ duration, initial, submitLabel, ariaLabel, requireChange = false, body }: Props) {
  const { run, pending, error } = useScheduleAction();
  const [weekday, setWeekday] = useState(initial.weekday);
  const [start, setStart] = useState(initial.start_time);
  const id = useId();
  const unchanged = requireChange && weekday === initial.weekday && start === initial.start_time;

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void run("/api/schedule/edits", body(weekday, start));
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor={`${id}-day`} className="block text-xs font-medium text-muted">Day</label>
          <select id={`${id}-day`} className="input py-1.5 text-sm" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
            {WEEKDAY_LABELS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-start`} className="block text-xs font-medium text-muted">Start</label>
          <select id={`${id}-start`} className="input py-1.5 text-sm tabular-nums" value={start} onChange={(e) => setStart(e.target.value)}>
            {startTimes(duration).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-secondary py-1.5" aria-label={ariaLabel} disabled={unchanged || pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
      {error && <InlineAlert>{error}</InlineAlert>}
    </form>
  );
}
