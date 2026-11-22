import { withAuth } from "@/lib/auth/api";
import { handleNotificationAction } from "@/lib/notifications/handlers";

// Edit, mark as sent (Copy message / Open WhatsApp) or dismiss a pending notification (SPEC §3.8).
export const PATCH = withAuth(async (request, ctx: RouteContext<"/api/notifications/[id]">) => {
  const { id } = await ctx.params;
  return handleNotificationAction(id, request);
});
