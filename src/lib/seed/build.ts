import { validateStudent } from "@/lib/students/validation";
import type { AvailabilityBlock, StudentInput } from "@/lib/students/types";
import { CAMBRIDGE } from "./data/cambridge";
import { INDIVIDUAL } from "./data/individual";
import { SCHOOL_SUPPORT } from "./data/school-support";
import type { SeedStudent } from "./types";

export const SEED_STUDENTS: SeedStudent[] = [...CAMBRIDGE, ...SCHOOL_SUPPORT, ...INDIVIDUAL];

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SLOT_RE = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d{2}:\d{2})-(\d{2}:\d{2})$/;

/** "Mon 17:00-19:00" → { weekday: 1, start_time: "17:00", end_time: "19:00" }. */
export function parseSlot(slot: string): AvailabilityBlock {
  const m = SLOT_RE.exec(slot);
  if (!m) throw new SeedDataError([`Bad slot "${slot}" (expected e.g. "Mon 17:00-19:00").`]);
  return { weekday: DAY_NAMES.indexOf(m[1]) + 1, start_time: m[2], end_time: m[3] };
}

export class SeedDataError extends Error {
  constructor(readonly problems: string[]) {
    super(`Seed data is invalid:\n  - ${problems.join("\n  - ")}`);
  }
}

/**
 * Runs every fake student through the same server-side validation as the Students form
 * (SPEC §3.9): phones normalised to E.164, guardian both-or-none, availability merged.
 * Throws SeedDataError listing every problem, so nothing is written from bad data.
 */
export function buildSeedStudents(records: SeedStudent[] = SEED_STUDENTS): StudentInput[] {
  const problems: string[] = [];
  const out: StudentInput[] = [];

  for (const r of records) {
    let availability: AvailabilityBlock[];
    try {
      availability = r.slots.map(parseSlot);
    } catch (e) {
      problems.push(`${r.full_name}: ${(e as SeedDataError).problems[0]}`);
      continue;
    }
    const result = validateStudent({
      full_name: r.full_name,
      phone: r.phone,
      goal: r.goal,
      cefr_level: r.cefr_level ?? null,
      school_year: r.school_year ?? null,
      guardian_name: r.guardian?.name ?? "",
      guardian_phone: r.guardian?.phone ?? "",
      availability,
    });
    if (!result.ok) {
      const fields = Object.entries(result.errors).map(([f, msg]) => `${f}: ${msg}`);
      problems.push(`${r.full_name}: ${fields.join("; ")}`);
    } else if (result.data.availability.length === 0) {
      problems.push(`${r.full_name}: has no availability (generation would be blocked).`);
    } else {
      out.push(result.data);
    }
  }

  const seen = new Set<string>();
  for (const s of out) {
    for (const phone of [s.phone, s.guardian_phone]) {
      if (!phone) continue;
      if (seen.has(phone)) problems.push(`${s.full_name}: phone ${phone} is used twice.`);
      seen.add(phone);
    }
  }

  if (problems.length > 0) throw new SeedDataError(problems);
  return out;
}
