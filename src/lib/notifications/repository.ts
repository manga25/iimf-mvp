import "server-only";
import { connection } from "next/server";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { Notification, NotificationAction, NotificationFilters, StoredNotification } from "./types";

// Reads and writes for the notifications log; writes go through supabase/migrations/0007_notification_rpc.sql.
export type NotificationWriteFailure = "not_found" | "not_pending" | "invalid" | "error";
const CODES: Record<string, NotificationWriteFailure> = { IM404: "not_found", IM409: "not_pending", "22023": "invalid" };

export type NotificationWriteResult = { ok: true; notification: StoredNotification } | { ok: false; reason: NotificationWriteFailure };

export class NotificationRepositoryError extends Error {}

async function createClient() {
  await connection(); // always read at request time (see students/repository.ts)
  return createSupabaseClient();
}

type Row = StoredNotification & { students: { full_name: string; guardian_name: string | null } | null };

/** The log, newest first, optionally filtered by type and status. */
export async function listNotifications(filters: NotificationFilters): Promise<Notification[]> {
  const supabase = await createClient();
  let query = supabase
    .from("notifications")
    .select("id, student_id, type, recipient, phone, message, status, session_id, payment_id, sent_at, created_at, students(full_name, guardian_name)")
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });
  if (filters.type !== "all") query = query.eq("type", filters.type);
  if (filters.status !== "all") query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw new NotificationRepositoryError(`listNotifications: ${error.message}`);
  return (data as unknown as Row[]).map(({ students, ...n }) => {
    const student_name = students?.full_name ?? "Unknown student";
    const recipient_name = n.recipient === "guardian" ? (students?.guardian_name ?? "Guardian") : student_name;
    return { ...n, student_name, recipient_name };
  });
}

const RPC = {
  save: "save_notification_message",
  send: "mark_notification_sent",
  dismiss: "dismiss_notification",
} as const;

export async function applyNotificationAction(id: string, input: NotificationAction): Promise<NotificationWriteResult> {
  const supabase = await createClient();
  const args = input.action === "dismiss" ? { p_id: id } : { p_id: id, p_message: input.message };
  const { data, error } = await supabase.rpc(RPC[input.action], args);
  if (error) {
    const reason = (error.code && CODES[error.code]) || "error";
    if (reason === "error") console.error(`${RPC[input.action]} failed:`, error.code, error.message);
    return { ok: false, reason };
  }
  return { ok: true, notification: data as StoredNotification };
}
