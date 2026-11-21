import { describe, expect, it } from "vitest";
import { findStudentsWithoutAvailability, generateDraft } from "@/lib/scheduling";
import { cambridge, individual } from "./fixtures";

describe("AC-3.1 pre-validation", () => {
  const ok = cambridge("ok", "B1", { slots: ["Mon 10:00-12:00"] });
  const empty = individual("empty", { slots: [], name: "Ana Silva" });
  const inactiveEmpty = individual("old", { slots: [], active: false });

  it("lists active students with no availability", () => {
    expect(findStudentsWithoutAvailability([ok, empty, inactiveEmpty]).map((s) => s.id)).toEqual(["empty"]);
  });

  it("blocks generation and returns those students", () => {
    const result = generateDraft([ok, empty]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missingAvailability.map((s) => s.full_name)).toEqual(["Ana Silva"]);
  });

  it("ignores inactive students without availability", () => {
    expect(generateDraft([ok, inactiveEmpty]).ok).toBe(true);
  });
});
