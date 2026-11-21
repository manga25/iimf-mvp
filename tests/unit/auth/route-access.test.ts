import { describe, expect, it } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { decideAccess } from "@/lib/auth/route-access";
import { config } from "@/proxy";

describe("decideAccess (AC-1.1, AC-1.3)", () => {
  it.each(["/dashboard", "/students", "/students/123/edit", "/payments"])(
    "redirects an unauthenticated visit to %s to /login",
    (path) => {
      expect(decideAccess(path, false)).toEqual({ kind: "redirect", to: "/login" });
    },
  );

  it.each(["/api", "/api/students", "/api/schedule/approve"])(
    "returns unauthorized for unauthenticated API path %s",
    (path) => {
      expect(decideAccess(path, false)).toEqual({ kind: "unauthorized" });
    },
  );

  it("does not treat lookalike paths as API paths", () => {
    expect(decideAccess("/apiary", false)).toEqual({ kind: "redirect", to: "/login" });
  });

  it("allows /login when logged out and sends logged-in users to the dashboard", () => {
    expect(decideAccess("/login", false)).toEqual({ kind: "allow" });
    expect(decideAccess("/login", true)).toEqual({ kind: "redirect", to: "/dashboard" });
  });

  it("allows every app and API path when authenticated", () => {
    expect(decideAccess("/dashboard", true)).toEqual({ kind: "allow" });
    expect(decideAccess("/api/students", true)).toEqual({ kind: "allow" });
  });
});

describe("proxy matcher", () => {
  it.each(["/", "/dashboard", "/login", "/students/1", "/api/students"])("runs on %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });

  it.each(["/_next/static/chunks/app.js", "/_next/image", "/favicon.ico", "/logo.svg"])(
    "skips static asset %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    },
  );
});
