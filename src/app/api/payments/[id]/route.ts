import { withAuth } from "@/lib/auth/api";
import { handleSetPaymentStatus } from "@/lib/payments/handlers";

// Mark a payment Paid (with the payment date) or back to Unpaid (SPEC §3.7).
export const PUT = withAuth(async (request, ctx: RouteContext<"/api/payments/[id]">) => {
  const { id } = await ctx.params;
  return handleSetPaymentStatus(id, request);
});
