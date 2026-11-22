import { withAuth } from "@/lib/auth/api";
import { handleDeleteBlock } from "@/lib/calendar/handlers";

// Delete a blocked period; the sessions it cancelled are restored (SPEC §3.5).
export const DELETE = withAuth(async (_request, ctx: RouteContext<"/api/blocked-periods/[id]">) => {
  const { id } = await ctx.params;
  return handleDeleteBlock(id);
});
