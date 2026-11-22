import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { buildOverdueNotifications } from "@/lib/notifications/overdue";
import { createOverdueNotifications, syncPayments } from "./repository";

/**
 * Lazy payment generation (SPEC §3.7, no cron): creates the missing rows of every
 * completed month, recalculates unpaid ones and creates each overdue notification once.
 * Deduplicated per request with React `cache`, so the layout and a page can both call it.
 * A failure is logged and never breaks the page.
 */
export const ensurePayments = cache(async (): Promise<void> => {
  // Outside the try: during prerendering this must reach React, not the catch below.
  await connection();
  try {
    const overdue = await syncPayments();
    if (overdue.length > 0) await createOverdueNotifications(buildOverdueNotifications(overdue));
  } catch (e) {
    console.error("payment sync failed:", e);
  }
});
