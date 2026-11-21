const LISBON = "Europe/Lisbon";

/** The calendar date in Lisbon (SPEC A3) as numbers. */
export function lisbonDate(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LISBON, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/**
 * SPEC §1 term derivation: approval in Aug–Dec of Y → Y-09-01 … (Y+1)-07-31;
 * in Jan–Jul of Y → (Y-1)-09-01 … Y-07-31.
 */
export function termFor(now: Date): { term_start: string; term_end: string } {
  const { year, month } = lisbonDate(now);
  const startYear = month >= 8 ? year : year - 1;
  return { term_start: `${startYear}-09-01`, term_end: `${startYear + 1}-07-31` };
}
