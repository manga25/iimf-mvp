import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Loading } from "@/components/ui/Loading";
import { ApproveButton } from "@/components/schedule/ApproveButton";
import { GenerateButton } from "@/components/schedule/GenerateButton";
import { GroupCard } from "@/components/schedule/GroupCard";
import { ApprovedBanner, DraftStatus } from "@/components/schedule/StatusBanner";
import { UnallocatedPanel } from "@/components/schedule/UnallocatedPanel";
import { ValidationPanel } from "@/components/schedule/ValidationPanel";
import { WeekGrid } from "@/components/schedule/WeekGrid";
import { listScheduleStudents, loadSchedule } from "@/lib/schedule/repository";
import { buildScheduleView } from "@/lib/schedule/view";

export const metadata: Metadata = { title: "Schedule" };

async function ScheduleContent() {
  const [schedule, students] = await Promise.all([loadSchedule(), listScheduleStudents()]);
  const view = buildScheduleView(schedule, students);
  const approved = schedule?.status === "approved";
  const blocked = view.missingAvailability.length > 0;

  if (!schedule) {
    return (
      <div className="space-y-6">
        <ValidationPanel students={view.missingAvailability} />
        <EmptyState title="No draft schedule yet">
          <p>Generate a draft from the active students and their availability. You can review and edit it before approving.</p>
          <div className="mt-4 flex justify-center"><GenerateButton hasDraft={false} blocked={blocked} /></div>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {approved && schedule.term_start && schedule.term_end ? (
        <ApprovedBanner termStart={schedule.term_start} termEnd={schedule.term_end} />
      ) : (
        <>
          <ValidationPanel students={view.missingAvailability} />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1"><DraftStatus summary={view.summary} /></div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <GenerateButton hasDraft blocked={blocked} />
              <ApproveButton summary={view.summary} />
            </div>
          </div>
        </>
      )}

      <WeekGrid groups={view.groups} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="classes-title">
          <h2 id="classes-title" className="mb-3 text-base font-semibold">Classes</h2>
          {view.groups.length === 0 ? (
            <EmptyState title="No classes in this draft">Regenerate the draft once enough students share availability.</EmptyState>
          ) : (
            <div className="space-y-3">
              {view.groups.map((g) => <GroupCard key={g.id} group={g} groups={view.groups} editable={!approved} />)}
            </div>
          )}
        </section>
        <div><UnallocatedPanel students={view.unallocated} groups={view.groups} editable={!approved} /></div>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  return (
    <>
      <PageHeader title="Schedule" description="Generate, review and approve the weekly class schedule." />
      <Suspense fallback={<Loading label="Loading schedule…" />}>
        <ScheduleContent />
      </Suspense>
    </>
  );
}
