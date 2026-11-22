import { withAuth } from "@/lib/auth/api";
import { handleCancelSession } from "@/lib/calendar/handlers";

// Cancel one session (cannot be undone) and notify each student (SPEC §3.5).
export const POST = withAuth(async (_request, ctx: RouteContext<"/api/sessions/[id]/cancel">) => {
  const { id } = await ctx.params;
  return handleCancelSession(id);
});
