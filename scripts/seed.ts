/**
 * Seeds ~40 fake students with availability (SPEC §7 step 3, A8).
 *
 *   npm run seed              # only into an empty database
 *   npm run seed -- --reset   # deletes existing students + draft schedule first
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * The service-role key bypasses RLS: it is read here, in Node, and never shipped to the browser.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { buildSeedStudents, SeedDataError } from "../src/lib/seed/build";
import { createSupabaseSeedStore } from "../src/lib/seed/supabase-store";
import { runSeed, SeedRefusedError } from "../src/lib/seed/writer";

async function main() {
  config({ path: ".env.local", quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new SeedRefusedError("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local (see .env.example).");
  }

  const reset = process.argv.includes("--reset");
  const students = buildSeedStudents();
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const summary = await runSeed(createSupabaseSeedStore(db), students, { reset });

  const byGoal = students.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.goal]: (acc[s.goal] ?? 0) + 1 }), {});
  if (summary.replaced > 0) console.log(`Removed ${summary.replaced} existing student(s) and any draft schedule.`);
  console.log(`Seeded ${summary.students} students and ${summary.availabilitySlots} availability slots.`);
  console.log(`  cambridge: ${byGoal.cambridge ?? 0}, school_support: ${byGoal.school_support ?? 0}, individual: ${byGoal.individual ?? 0}`);
}

main().catch((e: unknown) => {
  const known = e instanceof SeedRefusedError || e instanceof SeedDataError;
  console.error(known ? e.message : `Seeding failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
