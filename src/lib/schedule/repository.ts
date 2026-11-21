import "server-only";
import { connection } from "next/server";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { toMinutes, toTime } from "@/lib/students/availability";
import type { AvailabilityBlock } from "@/lib/students/types";
import type { DraftGroup } from "@/lib/scheduling";
import type { ScheduleRecord, ScheduleStudent, StoredGroup } from "./types";

// Error codes raised by supabase/migrations/0003_schedule_rpc.sql.
const CODES: Record<string, ScheduleWriteFailure> = { IM409: "locked", IM404: "no_draft", "22023": "invalid" };

export type ScheduleWriteFailure = "locked" | "no_draft" | "invalid" | "error";
export type ScheduleWriteResult = { ok: true; id: string } | { ok: false; reason: ScheduleWriteFailure };

export class ScheduleRepositoryError extends Error {}

async function createClient() {
  await connection(); // always read at request time (see students/repository.ts)
  return createSupabaseClient();
}

const hhmm = (t: string) => toTime(toMinutes(t) ?? 0);

const SCHEDULE_COLUMNS =
  "id, status, generated_at, approved_at, term_start, term_end, " +
  "class_groups(id, name, goal, cefr_level, school_year, weekday, start_time, duration_min, group_members(student_id))";

type GroupRow = Omit<StoredGroup, "member_ids"> & { group_members: { student_id: string }[] | null };
type ScheduleRow = Omit<ScheduleRecord, "groups"> & { class_groups: GroupRow[] | null };

function toRecord({ class_groups, ...rest }: ScheduleRow): ScheduleRecord {
  const groups = (class_groups ?? [])
    .map(({ group_members, ...g }) => ({
      ...g,
      start_time: hhmm(g.start_time),
      member_ids: (group_members ?? []).map((m) => m.student_id).sort(),
    }))
    .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time) || a.name.localeCompare(b.name));
  return { ...rest, groups };
}

/** The approved schedule if there is one, else the draft, else null. */
export async function loadSchedule(): Promise<ScheduleRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("schedules").select(SCHEDULE_COLUMNS);
  if (error) throw new ScheduleRepositoryError(`loadSchedule: ${error.message}`);
  const rows = data as unknown as ScheduleRow[];
  const row = rows.find((r) => r.status === "approved") ?? rows.find((r) => r.status === "draft");
  return row ? toRecord(row) : null;
}

type StudentRow = Omit<ScheduleStudent, "availability"> & { availability_slots: AvailabilityBlock[] | null };

/** Every student (active or not) with their availability — inactive ones may still sit in a stale draft. */
export async function listScheduleStudents(): Promise<ScheduleStudent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, goal, cefr_level, school_year, is_active, created_at, availability_slots(weekday, start_time, end_time)")
    .order("full_name");
  if (error) throw new ScheduleRepositoryError(`listScheduleStudents: ${error.message}`);
  return (data as unknown as StudentRow[]).map(({ availability_slots, ...s }) => ({
    ...s,
    availability: (availability_slots ?? [])
      .map((b) => ({ weekday: b.weekday, start_time: hhmm(b.start_time), end_time: hhmm(b.end_time) }))
      .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)),
  }));
}

function failure(error: { code?: string; message: string }, op: string): ScheduleWriteResult {
  const reason = (error.code && CODES[error.code]) || "error";
  if (reason === "error") console.error(`${op} failed:`, error.code, error.message);
  return { ok: false, reason };
}

/** Replaces the draft's classes atomically (generate: regenerate = true; manual edit: false). */
export async function saveDraft(groups: DraftGroup[], regenerate: boolean): Promise<ScheduleWriteResult> {
  const supabase = await createClient();
  const payload = groups.map((g) => ({
    name: g.name, goal: g.goal, cefr_level: g.cefr_level, school_year: g.school_year,
    weekday: g.weekday, start_time: g.start_time, duration_min: g.duration_min, member_ids: g.member_ids,
  }));
  const { data, error } = await supabase.rpc("save_draft", { p_groups: payload, p_regenerate: regenerate });
  if (error) return failure(error, "save_draft");
  return { ok: true, id: data as string };
}

/** Approves the draft and generates the term's sessions in one transaction. */
export async function approveSchedule(term: { term_start: string; term_end: string }): Promise<ScheduleWriteResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approve_schedule", { p_term_start: term.term_start, p_term_end: term.term_end });
  if (error) return failure(error, "approve_schedule");
  return { ok: true, id: data as string };
}
