import { describe, expect, it } from "vitest";
import { NAV_ITEMS, isActivePath } from "@/lib/navigation";

describe("navigation", () => {
  it("has exactly the 6 sections from SPEC, in order", () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      "Dashboard", "Students", "Schedule", "Attendance", "Payments", "Notifications",
    ]);
  });

  it.each([
    ["/students", "/students", true],
    ["/students/123", "/students", true],
    ["/students/new", "/students", true],
    ["/studentsx", "/students", false],
    ["/dashboard", "/students", false],
    [null, "/students", false],
  ])("isActivePath(%j, %j) = %j", (pathname, href, expected) => {
    expect(isActivePath(pathname, href)).toBe(expected);
  });
});
