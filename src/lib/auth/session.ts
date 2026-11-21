import "server-only";
import { createClient } from "@/lib/supabase/server";

export type AuthUser = { id: string; email: string | null };

/**
 * Returns the verified current user, or null when there is no valid session.
 * Data Access Layer entry point: every Server Action and Route Handler must
 * call this (directly or via withAuth) instead of relying on the proxy alone.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims?.sub) return null;
    return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
  } catch {
    return null;
  }
}
