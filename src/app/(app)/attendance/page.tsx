import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { BlockedPeriodList } from "@/components/calendar/BlockedPeriodList";
import { BlockPeriodForm } from "@/components/calendar/BlockPeriodForm";
import { CalendarBoard } from "@/components/calendar/CalendarBoard";
import { CalendarNav } from "@/components/calendar/CalendarNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { Loading } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { isIsoDate, lisbonNow, lisbonToday, weekDates } from "@/lib/calendar/dates";
import { listBlockedPeriods, listSessions } from "@/lib/calendar/repository";
import { buildWeek } from "@/lib/calendar/view";
import { isScheduleApproved } from "@/lib/students/repository";

export const metadata: Metadata = { title: "Attendance" };

async function CalendarContent({ searchParams }: Pick<PageProps<"/attendance">, "searchParams">) {
  await connection(); // "today" is request-time data
  const today = lisbonToday();
  const params = await searchParams;
  const date = isIsoDate(params.date) ? params.date : today;
  const days = weekDates(date);

  const [approved, sessions, blocks] = await Promise.all([
    isScheduleApproved(), listSessions(days[0], days[6]), listBlockedPeriods(),
  ]);
  const week = buildWeek(date, sessions, blocks, lisbonNow());
  // `?session=<id>` (Dashboard quick link) opens that panel — only if the session is in this week.
  const sessionId = sessions.some((s) => s.id === params.session) ? (params.session as string) : null;

  return (
    <div className="space-y-8">
      <section aria-label="Calendar" className="space-y-4">
        {!approved && (
          <EmptyState title="No sessions yet">
            Sessions appear here once the schedule is approved. You can already add blocked periods such as holidays.
          </EmptyState>
        )}
        {approved && (
          <>
            <CalendarNav date={date} today={today} />
            <CalendarBoard days={week} date={date} today={today} initialSessionId={sessionId} />
          </>
        )}
      </section>

      <section aria-labelledby="blocked-title" className="space-y-3">
        <h2 id="blocked-title" className="text-base font-semibold">Blocked periods</h2>
        <BlockPeriodForm defaultDate={date} />
        <BlockedPeriodList blocks={blocks} />
      </section>
    </div>
  );
}

export default function AttendancePage({ searchParams }: PageProps<"/attendance">) {
  return (
    <>
      <PageHeader title="Attendance" description="Weekly calendar of sessions. Open a session to mark Late/Absent, add remarks or change it." />
      <Suspense fallback={<Loading label="Loading calendar…" />}>
        <CalendarContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
