"use client";

import type { GroupView } from "@/lib/schedule/view";
import { SlotForm } from "./SlotForm";

/** Change a class's weekday/start time (SPEC §3.4). Overlaps and times outside a member's availability are rejected by the server. */
export function RescheduleForm({ group }: { group: GroupView }) {
  return (
    <SlotForm
      duration={group.duration_min}
      initial={group}
      submitLabel="Change time"
      requireChange
      body={(weekday, start_time) => ({ type: "reschedule", group_id: group.id, weekday, start_time })}
    />
  );
}
