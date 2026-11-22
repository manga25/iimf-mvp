import "server-only";
import { connection } from "next/server";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { NewSessionNotification } from "@/lib/notifications/session";
import { toLisbonLocal } from "./dates";
import type { BlockedPeriod, BlockedPeriodInput, CalendarSession, Modality, SessionMember } from "./types";

// Error codes raised by supabase/migrations/0004_session_rpc.sql.
export type CalendarWriteFailure = "not_found" | "cancelled" | "finished" | "same_modality" | "invalid" | "error";
const CODES: Record<string, CalendarWriteFailure> = {
  IM404: "not_found", IM409: "cancelled", IM410: "finished", IM412: "same_modality", "22023": "invalid",
};

export type CalendarWriteResult<T = object> = ({ ok: true } & T) | { ok: false; reason: CalendarWriteFailure };

export class CalendarRepositoryError extends Error {}

async function createClient() {
  await connection(); // always read at request time (see students/repository.ts)
  return createSupabaseClient();
}

const SESSION_COLUMNS =
  "id, group_id, date, start_time, end_time, status, modality, blocked_period_id, " +
  "class_groups!inner(name, goal, group_members(students(id, full_name, phone, guardian_name, guardian_phone)))";

type SessionRow = Omit<CalendarSession, "name" | "goal" | "members"> & {
  class_groups: { name: string; goal: CalendarSession["goal"]; group_members: { students: SessionMember | null }[] | null };
};

const hhmm = (t: string) => t.slice(0, 5);

function toSession({ class_groups: g, ...s }: SessionRow): CalendarSession {
  const members = (g.group_members ?? [])
    .map((m) => m.students)
    .filter((m): m is SessionMember => m !== null)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  return { ...s, start_time: hhmm(s.start_time), end_time: hhmm(s.end_time), name: g.name, goal: g.goal, members };
}

/** Sessions with date in [from, to] (inclusive, "YYYY-MM-DD"). */
export async function listSessions(from: string, to: string): Promise<CalendarSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sessions").select(SESSION_COLUMNS).gte("date", from).lte("date", to);
  if (error) throw new CalendarRepositoryError(`listSessions: ${error.message}`);
  return (data as unknown as SessionRow[]).map(toSession);
}

export async function getSession(id: string): Promise<CalendarSession | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sessions").select(SESSION_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new CalendarRepositoryError(`getSession: ${error.message}`);
  return data ? toSession(data as unknown as SessionRow) : null;
}

/** Every blocked period, earliest first, with Lisbon wall-clock times. */
export async function listBlockedPeriods(): Promise<BlockedPeriod[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("blocked_periods").select("id, start_at, end_at, reason").order("start_at");
  if (error) throw new CalendarRepositoryError(`listBlockedPeriods: ${error.message}`);
  return (data ?? []).map((b) => ({ id: b.id, reason: b.reason, start: toLisbonLocal(b.start_at), end: toLisbonLocal(b.end_at) }));
}

function failure(error: { code?: string; message: string }, op: string): { ok: false; reason: CalendarWriteFailure } {
  const reason = (error.code && CODES[error.code]) || "error";
  if (reason === "error") console.error(`${op} failed:`, error.code, error.message);
  return { ok: false, reason };
}

export async function createBlockedPeriod(input: BlockedPeriodInput): Promise<CalendarWriteResult<{ id: string; cancelled: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_blocked_period", { p_start: input.start, p_end: input.end, p_reason: input.reason });
  if (error) return failure(error, "create_blocked_period");
  const r = data as { id: string; cancelled: number };
  return { ok: true, id: r.id, cancelled: r.cancelled };
}

export async function deleteBlockedPeriod(id: string): Promise<CalendarWriteResult<{ restored: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_blocked_period", { p_id: id });
  if (error) return failure(error, "delete_blocked_period");
  return { ok: true, restored: (data as { restored: number }).restored };
}

export async function cancelSession(id: string, notifications: NewSessionNotification[]): Promise<CalendarWriteResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_session", { p_id: id, p_notifications: notifications });
  return error ? failure(error, "cancel_session") : { ok: true };
}

export async function setSessionModality(id: string, modality: Modality, notifications: NewSessionNotification[]): Promise<CalendarWriteResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_session_modality", { p_id: id, p_modality: modality, p_notifications: notifications });
  return error ? failure(error, "set_session_modality") : { ok: true };
}
