"use client";

import { useState } from "react";
import type { DayView } from "@/lib/calendar/view";
import { DayColumn } from "./DayColumn";
import { SessionPanel } from "./SessionPanel";

type Props = { days: DayView[]; date: string; today: string };

/** Week view (≥ lg) and day view (< lg) of the same data, plus the session panel. */
export function CalendarBoard({ days, date, today }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const session = days.flatMap((d) => d.sessions).find((s) => s.id === openId) ?? null;
  const selectedDay = days.find((d) => d.date === date) ?? days[0];

  return (
    <>
      <div data-testid="week-view" className="hidden gap-2 lg:grid lg:grid-cols-7">
        {days.map((day) => <DayColumn key={day.date} day={day} today={today} onOpen={setOpenId} compact />)}
      </div>
      <div data-testid="day-view" className="lg:hidden">
        <DayColumn day={selectedDay} today={today} onOpen={setOpenId} />
      </div>
      <SessionPanel session={session} onClose={() => setOpenId(null)} />
    </>
  );
}
