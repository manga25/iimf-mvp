import "server-only";
import { NextResponse } from "next/server";
import { getAuthUser, type AuthUser } from "./session";
import { UNAUTHORIZED_MESSAGE } from "./messages";

export function unauthorizedResponse() {
  return NextResponse.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 });
}

/**
 * Wraps a Route Handler so it only runs for an authenticated teacher (AC-1.3).
 * Usage: export const GET = withAuth(async (request, context, user) => { ... });
 */
export function withAuth<Ctx>(
  handler: (request: Request, context: Ctx, user: AuthUser) => Promise<Response> | Response,
) {
  return async (request: Request, context: Ctx): Promise<Response> => {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();
    return handler(request, context, user);
  };
}
