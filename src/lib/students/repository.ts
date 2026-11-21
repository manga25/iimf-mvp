import "server-only";
import { connection } from "next/server";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { toMinutes, toTime } from "./availability";
import { escapeLike, type StudentFilters } from "./filters";
import type { AvailabilityBlock, Student, StudentInput } from "./types";

// Error codes raised by supabase/migrations/0002_student_rpc.sql.
const LOCKED = "IM409";
const NOT_FOUND = "IM404";

export type WriteResult = { ok: true; id: string } | { ok: false; reason: "locked" | "not_found" | "error" };

/** Thrown by read functions; pages show a friendly message via error.tsx. */
export class RepositoryError extends Error {}

/**
 * Student data is always read at request time. connection() tells Next.js so
 * before supabase-js runs (it reads the clock, which Cache Components rejects during prerender).
 */
async function createClient() {
  await connection();
  return createSupabaseClient();
}

const COLUMNS =
  "id, full_name, phone, goal, cefr_level, school_year, guardian_name, guardian_phone, is_active, " +
  "availability_slots(weekday, start_time, end_time)";

type Row = Omit<Student, "availability"> & { availability_slots: AvailabilityBlock[] | null };

const hhmm = (t: string) => toTime(toMinutes(t) ?? 0);

function toStudent({ availability_slots, ...rest }: Row): Student {
  const availability = (availability_slots ?? [])
    .map((b) => ({ weekday: b.weekday, start_time: hhmm(b.start_time), end_time: hhmm(b.end_time) }))
    .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
  return { ...rest, availability };
}

export async function listStudents(filters: StudentFilters): Promise<Student[]> {
  const supabase = await createClient();
  let query = supabase.from("students").select(COLUMNS).order("full_name");
  if (filters.status !== "all") query = query.eq("is_active", filters.status === "active");
  if (filters.goal) query = query.eq("goal", filters.goal);
  if (filters.q) query = query.ilike("full_name", `%${escapeLike(filters.q)}%`);

  const { data, error } = await query;
  if (error) throw new RepositoryError(`listStudents: ${error.message}`);
  return (data as unknown as Row[]).map(toStudent);
}

export async function getStudent(id: string): Promise<Student | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("students").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new RepositoryError(`getStudent: ${error.message}`);
  return data ? toStudent(data as unknown as Row) : null;
}

/** AC-2.7: true once a schedule has been approved (students become read-only). */
export async function isScheduleApproved(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("schedules").select("id").eq("status", "approved").limit(1);
  if (error) throw new RepositoryError(`isScheduleApproved: ${error.message}`);
  return (data ?? []).length > 0;
}

function writeFailure(error: { code?: string; message: string }, op: string): WriteResult {
  if (error.code === LOCKED) return { ok: false, reason: "locked" };
  if (error.code === NOT_FOUND) return { ok: false, reason: "not_found" };
  console.error(`${op} failed:`, error.code, error.message);
  return { ok: false, reason: "error" };
}

/** Creates (id = null) or updates a student and replaces their availability atomically. */
export async function saveStudent(id: string | null, input: StudentInput): Promise<WriteResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_student", {
    p_id: id,
    p_full_name: input.full_name,
    p_phone: input.phone,
    p_goal: input.goal,
    p_cefr_level: input.cefr_level,
    p_school_year: input.school_year,
    p_guardian_name: input.guardian_name,
    p_guardian_phone: input.guardian_phone,
    p_availability: input.availability,
  });
  if (error) return writeFailure(error, "save_student");
  return { ok: true, id: data as string };
}

export async function deactivateStudent(id: string): Promise<WriteResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("deactivate_student", { p_id: id });
  if (error) return writeFailure(error, "deactivate_student");
  return { ok: true, id };
}
