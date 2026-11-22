import type { Metadata } from "next";
import { Suspense } from "react";
import { NotificationFilters } from "@/components/notifications/NotificationFilters";
import { NotificationList } from "@/components/notifications/NotificationList";
import { Loading } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { ensurePayments } from "@/lib/payments/sync";
import { parseNotificationFilters } from "@/lib/notifications/filters";
import { listNotifications } from "@/lib/notifications/repository";

export const metadata: Metadata = { title: "Notifications" };

async function NotificationsContent({ searchParams }: Pick<PageProps<"/notifications">, "searchParams">) {
  await ensurePayments(); // overdue notifications are created lazily (shared with the layout's sync)
  const filters = parseNotificationFilters(await searchParams);
  const notifications = await listNotifications(filters);
  return (
    <>
      <NotificationFilters filters={filters} />
      <NotificationList notifications={notifications} filtered={filters.type !== "all" || filters.status !== "all"} />
    </>
  );
}

export default function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  return (
    <>
      <PageHeader title="Notifications" description="WhatsApp messages ready to copy or send. Newest first." />
      <Suspense fallback={<Loading label="Loading notifications…" />}>
        <NotificationsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
