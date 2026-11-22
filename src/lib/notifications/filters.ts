import {
  NOTIFICATION_STATUSES, NOTIFICATION_TYPES,
  type NotificationFilters, type NotificationStatus, type NotificationType,
} from "./types";

type Param = string | string[] | undefined;
const first = (v: Param) => (Array.isArray(v) ? v[0] : v);

/** Reads `?type=` and `?status=`; anything unknown falls back to "all". */
export function parseNotificationFilters(params: { type?: Param; status?: Param }): NotificationFilters {
  const type = first(params.type);
  const status = first(params.status);
  return {
    type: NOTIFICATION_TYPES.includes(type as NotificationType) ? (type as NotificationType) : "all",
    status: NOTIFICATION_STATUSES.includes(status as NotificationStatus) ? (status as NotificationStatus) : "all",
  };
}
