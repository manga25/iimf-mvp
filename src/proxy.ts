import { NextResponse, type NextRequest } from "next/server";
import { updateSession, withSessionCookies } from "@/lib/supabase/proxy";
import { decideAccess } from "@/lib/auth/route-access";
import { UNAUTHORIZED_MESSAGE } from "@/lib/auth/messages";

export async function proxy(request: NextRequest) {
  const { response, isAuthenticated } = await updateSession(request);
  const decision = decideAccess(request.nextUrl.pathname, isAuthenticated);

  if (decision.kind === "unauthorized") {
    return withSessionCookies(
      NextResponse.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 }),
      response,
    );
  }
  if (decision.kind === "redirect") {
    return withSessionCookies(NextResponse.redirect(new URL(decision.to, request.url)), response);
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except Next.js internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
