// Pure routing rules for authentication (AC-1.1, AC-1.3). Used by src/proxy.ts.

export const LOGIN_PATH = "/login";
export const HOME_PATH = "/dashboard";

const PUBLIC_PATHS = new Set([LOGIN_PATH]);

export type AccessDecision =
  | { kind: "allow" }
  | { kind: "redirect"; to: string }
  | { kind: "unauthorized" };

export function isApiPath(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function decideAccess(pathname: string, isAuthenticated: boolean): AccessDecision {
  if (PUBLIC_PATHS.has(pathname)) {
    // A logged-in teacher has no reason to see the login page.
    return isAuthenticated ? { kind: "redirect", to: HOME_PATH } : { kind: "allow" };
  }
  if (isAuthenticated) return { kind: "allow" };
  return isApiPath(pathname) ? { kind: "unauthorized" } : { kind: "redirect", to: LOGIN_PATH };
}
