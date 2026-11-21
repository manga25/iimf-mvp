import { withAuth } from "@/lib/auth/api";
import { handleDeactivate } from "@/lib/students/handlers";

// Deactivate (soft delete) a student — only before approval (SPEC §2, AC-2.6/2.7).
export const POST = withAuth(async (_request, ctx: RouteContext<"/api/students/[id]/deactivate">) => {
  const { id } = await ctx.params;
  return handleDeactivate(id);
});
