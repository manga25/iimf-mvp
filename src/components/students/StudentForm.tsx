"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { blocksToCells, cellsToBlocks, emptyCells } from "@/lib/students/availability";
import { GOAL_LABELS } from "@/lib/students/labels";
import { CEFR_LEVELS, GOALS, SCHOOL_YEARS, type Goal, type Student } from "@/lib/students/types";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { FormField } from "./FormField";
import { useStudentSubmit } from "./useStudentSubmit";

const GOAL_HINTS: Record<Goal, string> = {
  cambridge: "Group class (3–7 students at the same CEFR level), 90 min per week, 15 € per class.",
  school_support: "Group class (3–7 students in the same school year), 90 min per week, 15 € per class.",
  individual: "One-to-one class, 60 min per week, 25 € per class.",
};

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="card p-4 sm:p-6">
      <h2 id={id} className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** Create / edit form with conditional goal fields, optional guardian and availability grid (SPEC §5). */
export function StudentForm({ student }: { student?: Student }) {
  const { submit, errors, formError, attempt, pending } = useStudentSubmit(student?.id ?? null);
  const [v, setV] = useState({
    full_name: student?.full_name ?? "",
    phone: student?.phone ?? "",
    goal: (student?.goal ?? "") as Goal | "",
    cefr_level: student?.cefr_level ?? "",
    school_year: student?.school_year ? String(student.school_year) : "",
    guardian_name: student?.guardian_name ?? "",
    guardian_phone: student?.guardian_phone ?? "",
  });
  const [cells, setCells] = useState(() => (student ? blocksToCells(student.availability) : emptyCells()));
  const alertRef = useRef<HTMLDivElement>(null);
  const gridId = useId();

  useEffect(() => {
    if (attempt > 0) alertRef.current?.focus();
  }, [attempt]);

  const set = (key: keyof typeof v) => (e: { target: { value: string } }) => setV((prev) => ({ ...prev, [key]: e.target.value }));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit({
      ...v,
      goal: v.goal || null,
      cefr_level: v.goal === "cambridge" ? v.cefr_level : null,
      school_year: v.goal === "school_support" ? v.school_year : null,
      availability: cellsToBlocks(cells),
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {formError && (
        <div ref={alertRef} tabIndex={-1} role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          {formError}
        </div>
      )}

      <Section title="Student details">
        <FormField id="full_name" label="Full name" error={errors.full_name}>
          {(a) => <input {...a} className="input" autoComplete="off" maxLength={100} value={v.full_name} onChange={set("full_name")} />}
        </FormField>
        <FormField id="phone" label="Phone" error={errors.phone} hint="Portuguese numbers: 9 digits. Other countries: start with + and the country code.">
          {(a) => <input {...a} type="tel" inputMode="tel" className="input" value={v.phone} onChange={set("phone")} />}
        </FormField>
      </Section>

      <Section title="Goal">
        <FormField id="goal" label="Goal" error={errors.goal} hint={v.goal ? GOAL_HINTS[v.goal] : undefined}>
          {(a) => (
            <select {...a} className="input" value={v.goal} onChange={set("goal")}>
              <option value="">Choose a goal…</option>
              {GOALS.map((g) => <option key={g} value={g}>{GOAL_LABELS[g]}</option>)}
            </select>
          )}
        </FormField>
        {v.goal === "cambridge" && (
          <FormField id="cefr_level" label="CEFR level" error={errors.cefr_level}>
            {(a) => (
              <select {...a} className="input" value={v.cefr_level} onChange={set("cefr_level")}>
                <option value="">Choose a level…</option>
                {CEFR_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            )}
          </FormField>
        )}
        {v.goal === "school_support" && (
          <FormField id="school_year" label="School year" error={errors.school_year}>
            {(a) => (
              <select {...a} className="input" value={v.school_year} onChange={set("school_year")}>
                <option value="">Choose a year…</option>
                {SCHOOL_YEARS.map((y) => <option key={y} value={y}>Year {y}</option>)}
              </select>
            )}
          </FormField>
        )}
        {v.goal !== "cambridge" && errors.cefr_level && <p className="text-sm text-danger">{errors.cefr_level}</p>}
        {v.goal !== "school_support" && errors.school_year && <p className="text-sm text-danger">{errors.school_year}</p>}
      </Section>

      <Section title="Guardian" description="Optional. Fill in both fields or leave both empty. Notifications go to the guardian when one is set.">
        <FormField id="guardian_name" label="Guardian's name" optional error={errors.guardian_name}>
          {(a) => <input {...a} className="input" autoComplete="off" maxLength={100} value={v.guardian_name} onChange={set("guardian_name")} />}
        </FormField>
        <FormField id="guardian_phone" label="Guardian's phone" optional error={errors.guardian_phone}>
          {(a) => <input {...a} type="tel" inputMode="tel" className="input" value={v.guardian_phone} onChange={set("guardian_phone")} />}
        </FormField>
      </Section>

      <Section title="Weekly availability" description="When can this student attend? Times between 08:00 and 20:00, in 30-minute blocks.">
        <p id={`${gridId}-label`} className="sr-only">Weekly availability</p>
        <p id={`${gridId}-hint`} className="text-xs text-muted">
          Click or drag to select times. Keyboard: arrow keys to move, Space to toggle, Shift + arrow to copy the selection while moving.
        </p>
        <AvailabilityGrid value={cells} onChange={setCells} labelledBy={`${gridId}-label`} describedBy={`${gridId}-hint`} />
        {errors.availability && <p className="text-sm text-danger">{errors.availability}</p>}
      </Section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={student ? `/students/${student.id}` : "/students"} className="btn-secondary">Cancel</Link>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : student ? "Save changes" : "Create student"}
        </button>
      </div>
    </form>
  );
}
