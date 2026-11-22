import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { DashboardAlerts } from "@/components/dashboard/DashboardAlerts";
import { PaymentCounters } from "@/components/dashboard/PaymentCounters";
import { TodayClasses, UpcomingClasses } from "@/components/dashboard/SessionLists";
import { EmptyState } from "@/components/ui/EmptyState";
import { Loading } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { lisbonToday } from "@/lib/calendar/dates";
import { listSessions } from "@/lib/calendar/repository";
import { countPendingNotifications, listUnpaidPayments } from "@/lib/dashboard/repository";
import { buildAlerts, dashboardRange, paymentCounters, splitSessions } from "@/lib/dashboard/view";
import { ensurePayments } from "@/lib/payments/sync";
import { listScheduleStudents, loadSchedule } from "@/lib/schedule/repository";

export const metadata: Metadata = { title: "Dashboard" };

async function DashboardContent() {
  await connection(); // "today" is request-time data
  await ensurePayments(); // shared with the layout's sync in the same request, so counts are fresh
  const today = lisbonToday();
  const { from, to } = dashboardRange(today);

  const [schedule, students, sessions, unpaid, pending] = await Promise.all([
    loadSchedule(), listScheduleStudents(), listSessions(from, to), listUnpaidPayments(), countPendingNotifications(),
  ]);
  const approved = schedule?.status === "approved";
  const classes = splitSessions(sessions, today);
  const counters = paymentCounters(unpaid, today);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        {approved ? (
          <>
            <TodayClasses today={today} sessions={classes.today} />
            <UpcomingClasses days={classes.upcoming} />
          </>
        ) : (
          <EmptyState title="No classes yet">
            Today&apos;s and upcoming classes appear here once the schedule is approved on the Schedule page.
          </EmptyState>
        )}
      </div>
      <div className="space-y-6">
        <PaymentCounters unpaid={counters.unpaid} overdue={counters.overdue} approved={approved} />
        <DashboardAlerts alerts={buildAlerts(schedule, students, pending)} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Today's classes, upcoming week, payments and alerts." />
      <Suspense fallback={<Loading label="Loading dashboard…" />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}
