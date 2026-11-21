import { withAuth } from "@/lib/auth/api";
import { handleSave } from "@/lib/students/handlers";

// Edit a student and replace their availability (SPEC §3.9).
export const PATCH = withAuth(async (request, ctx: RouteContext<"/api/students/[id]">) => {
  const { id } = await ctx.params;
  return handleSave(request, id);
});
