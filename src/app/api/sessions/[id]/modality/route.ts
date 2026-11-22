import { withAuth } from "@/lib/auth/api";
import { handleSetModality } from "@/lib/calendar/handlers";

// Switch one session In-Person ↔ Online and notify each student (SPEC §3.5).
export const POST = withAuth(async (request, ctx: RouteContext<"/api/sessions/[id]/modality">) => {
  const { id } = await ctx.params;
  return handleSetModality(id, request);
});
