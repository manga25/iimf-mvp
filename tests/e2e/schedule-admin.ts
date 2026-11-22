import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * TEST-ONLY database access for the schedule E2E spec (approval is irreversible in the app).
 * Uses the service-role key from .env.local, in the Playwright (Node) process only —
 * it is never imported by app code or shipped to the browser.
 */
export const E2E_PREFIX = "E2E Schedule";

type Row = Record<string, unknown>;
export type DraftSnapshot = { schedule: Row; groups: Row[]; members: Row[] } | null;

export function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Throws on a Supabase error; a null result (e.g. a delete) becomes an empty list. */
const must = <T>({ data, error }: { data: T[] | null; error: { message: string } | null }, op: string): T[] => {
  if (error) throw new Error(`${op}: ${error.message}`);
  return data ?? [];
};

export async function hasApprovedSchedule(db: SupabaseClient) {
  return must(await db.from("schedules").select("id").eq("status", "approved"), "check approved").length > 0;
}

/** Saves the teacher's current draft (if any) so it can be put back after the spec. */
export async function snapshotDraft(db: SupabaseClient): Promise<DraftSnapshot> {
  const [schedule] = must(await db.from("schedules").select("*").eq("status", "draft"), "read draft");
  if (!schedule) return null;
  const groups = must(await db.from("class_groups").select("*").eq("schedule_id", schedule.id), "read groups");
  const ids = groups.map((g) => g.id as string);
  const members = ids.length ? must(await db.from("group_members").select("*").in("group_id", ids), "read members") : [];
  return { schedule, groups, members };
}

/** Deletes every schedule (and its sessions), the E2E students, notifications and blocks, then restores the snapshot. */
export async function cleanUp(db: SupabaseClient, snapshot: DraftSnapshot) {
  const e2eStudents = must(await db.from("students").select("id").like("full_name", `${E2E_PREFIX}%`), "list E2E students");
  const studentIds = e2eStudents.map((s) => s.id as string);
  if (studentIds.length) must(await db.from("notifications").delete().in("student_id", studentIds), "delete E2E notifications");
  must(await db.from("blocked_periods").delete().like("reason", `${E2E_PREFIX}%`), "delete E2E blocked periods");

  const groupIds = must(await db.from("class_groups").select("id"), "list groups").map((g) => g.id as string);
  if (groupIds.length) must(await db.from("sessions").delete().in("group_id", groupIds), "delete sessions");
  must(await db.from("schedules").delete().not("id", "is", null), "delete schedules"); // cascades groups/members
  must(await db.from("students").delete().like("full_name", `${E2E_PREFIX}%`), "delete E2E students");

  if (!snapshot) return;
  must(await db.from("schedules").insert(snapshot.schedule), "restore draft");
  if (snapshot.groups.length) must(await db.from("class_groups").insert(snapshot.groups), "restore groups");
  if (snapshot.members.length) must(await db.from("group_members").insert(snapshot.members), "restore members");
}
