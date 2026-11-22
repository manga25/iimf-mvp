import "server-only";
import { connection } from "next/server";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { PaymentStatus } from "@/lib/payments/types";

// Read-only queries the Dashboard needs on top of the other sections' repositories.
export class DashboardRepositoryError extends Error {}

async function createClient() {
  await connection(); // always read at request time (see students/repository.ts)
  return createSupabaseClient();
}

/** Every unpaid charge of the term (all months); overdue is derived from `month` by the caller. */
export async function listUnpaidPayments(): Promise<{ status: PaymentStatus; month: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("payments").select("status, month").eq("status", "unpaid");
  if (error) throw new DashboardRepositoryError(`listUnpaidPayments: ${error.message}`);
  return data ?? [];
}

/** Number of notifications still waiting to be sent. */
export async function countPendingNotifications(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("status", "pending");
  if (error) throw new DashboardRepositoryError(`countPendingNotifications: ${error.message}`);
  return count ?? 0;
}
