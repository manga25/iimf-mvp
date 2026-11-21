import type { SupabaseClient } from "@supabase/supabase-js";
import type { AvailabilityRow, SeedStore, StudentRow } from "./writer";

/** Seed store backed by a service-role Supabase client (bypasses RLS; Node script only). */
export function createSupabaseSeedStore(db: SupabaseClient): SeedStore {
  const check = (op: string, error: { message: string } | null) => {
    if (error) throw new Error(`${op} failed: ${error.message}`);
  };

  return {
    async hasApprovedSchedule() {
      const { data, error } = await db.from("schedules").select("id").eq("status", "approved").limit(1);
      check("Reading schedules", error);
      return (data ?? []).length > 0;
    },
    async countStudents() {
      const { count, error } = await db.from("students").select("id", { count: "exact", head: true });
      check("Counting students", error);
      return count ?? 0;
    },
    async clearStudentsAndDrafts() {
      check("Deleting draft schedules", (await db.from("schedules").delete().eq("status", "draft")).error);
      // PostgREST requires a filter on delete; this one matches every row.
      check("Deleting students", (await db.from("students").delete().not("id", "is", null)).error);
    },
    async insertStudents(rows: StudentRow[]) {
      check("Inserting students", (await db.from("students").insert(rows)).error);
    },
    async insertAvailability(rows: AvailabilityRow[]) {
      check("Inserting availability", (await db.from("availability_slots").insert(rows)).error);
    },
    async deleteStudents(ids: string[]) {
      check("Rolling back students", (await db.from("students").delete().in("id", ids)).error);
    },
  };
}
