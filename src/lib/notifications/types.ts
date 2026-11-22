import type { Recipient } from "./recipient";

// Notifications log (SPEC §3.8).

export const NOTIFICATION_TYPES = ["absence", "overdue", "cancellation", "modality_change"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_STATUSES = ["pending", "sent", "dismissed"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const TYPE_LABELS: Record<NotificationType, string> = {
  absence: "Absence",
  overdue: "Overdue payment",
  cancellation: "Cancellation",
  modality_change: "Modality change",
};
export const STATUS_LABELS: Record<NotificationStatus, string> = { pending: "Pending", sent: "Sent", dismissed: "Dismissed" };

export type TypeFilter = NotificationType | "all";
export type StatusFilter = NotificationStatus | "all";
export type NotificationFilters = { type: TypeFilter; status: StatusFilter };

export const MESSAGE_MAX = 2000;

/** A notification as stored (what the API returns). */
export type StoredNotification = {
  id: string;
  student_id: string;
  type: NotificationType;
  recipient: Recipient;
  phone: string;
  message: string;
  status: NotificationStatus;
  session_id: string | null;
  payment_id: string | null;
  sent_at: string | null;
  created_at: string;
};

/** A notification as shown in the log. `recipient_name` is the student or the guardian. */
export type Notification = StoredNotification & { student_name: string; recipient_name: string };

/** A validated teacher action on a pending notification. */
export type NotificationAction =
  | { action: "save"; message: string }
  | { action: "send"; message: string }
  | { action: "dismiss" };
