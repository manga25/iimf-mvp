import { handleSetAttendance } from "@/lib/attendance/handlers";
import { withAuth } from "@/lib/auth/api";

// Set one student's attendance (Present/Late/Absent) and remarks for a session (SPEC §3.6).
export const PUT = withAuth(async (request, ctx: RouteContext<"/api/sessions/[id]/attendance">) => {
  const { id } = await ctx.params;
  return handleSetAttendance(id, request);
});
