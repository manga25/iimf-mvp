"use client";

import { useId, useState } from "react";
import { WEEKDAY_LABELS } from "@/lib/students/labels";
import type { GroupView } from "@/lib/schedule/view";
import { endTime } from "./goalStyles";
import { InlineAlert } from "./InlineAlert";
import { useScheduleAction } from "./useScheduleAction";

/** Start times on the 30-min grid where a class of this length fits in 08:00–20:00 (H1). */
const startTimes = (duration: number) =>
  Array.from({ length: (12 * 60 - duration) / 30 + 1 }, (_, i) => endTime("08:00", i * 30));

/** Change a class's weekday/start time (SPEC §3.4). Overlaps are rejected by the server (H2). */
export function RescheduleForm({ group }: { group: GroupView }) {
  const { run, pending, error } = useScheduleAction();
  const [weekday, setWeekday] = useState(group.weekday);
  const [start, setStart] = useState(group.start_time);
  const id = useId();
  const unchanged = weekday === group.weekday && start === group.start_time;

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void run("/api/schedule/edits", { type: "reschedule", group_id: group.id, weekday, start_time: start });
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
            {startTimes(group.duration_min).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-secondary py-1.5" disabled={unchanged || pending}>
          {pending ? "Saving…" : "Change time"}
        </button>
      </div>
      {error && <InlineAlert>{error}</InlineAlert>}
    </form>
  );
}
