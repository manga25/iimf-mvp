import { lisbonDate } from "@/lib/schedule/term";

// Calendar dates are plain "YYYY-MM-DD" strings (Lisbon calendar, SPEC A3).
// Arithmetic runs on UTC midnights so it never depends on the server's time zone.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n: number) => String(n).padStart(2, "0");

const toUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fromUtc = (d: Date) => d.toISOString().slice(0, 10);

/** True for a real calendar date such as "2026-11-24" (rejects "2026-02-30"). */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const m = ISO_DATE.exec(v);
  if (!m) return false;
  return fromUtc(toUtc(v)) === v && Number(m[1]) >= 2000 && Number(m[1]) <= 2100;
}

/** Today's date in Lisbon. */
export function lisbonToday(now: Date = new Date()): string {
  const { year, month, day } = lisbonDate(now);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** "Now" in Lisbon as a wall-clock "YYYY-MM-DDTHH:MM" (comparable with session times). */
export function lisbonNow(now: Date = new Date()): string {
  return toLisbonLocal(now.toISOString());
}

/** A timestamptz (ISO string) → Lisbon wall-clock "YYYY-MM-DDTHH:MM". */
export function toLisbonLocal(timestamp: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function addDays(iso: string, days: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** 1 = Monday … 7 = Sunday. */
export const isoWeekday = (iso: string) => ((toUtc(iso).getUTCDay() + 6) % 7) + 1;

/** The Monday of the week containing `iso`. */
export const weekStart = (iso: string) => addDays(iso, 1 - isoWeekday(iso));

/** The 7 dates (Mon → Sun) of the week containing `iso`. */
export const weekDates = (iso: string) => Array.from({ length: 7 }, (_, i) => addDays(weekStart(iso), i));

const fmt = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(toUtc(iso));

/** "Tuesday, 24 November 2026" — used in messages. */
export const formatLongDate = (iso: string) => fmt(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** "Tue 24 Nov". */
export const formatShortDate = (iso: string) => fmt(iso, { weekday: "short", day: "numeric", month: "short" });

/** "23 Nov – 29 Nov 2026" for a week header. */
export function formatWeekRange(iso: string): string {
  const [first, last] = [weekStart(iso), addDays(weekStart(iso), 6)];
  return `${fmt(first, { day: "numeric", month: "short" })} – ${fmt(last, { day: "numeric", month: "short", year: "numeric" })}`;
}

/** "2026-12-23T00:00" → "23 Dec 2026, 00:00". */
export function formatLocalDateTime(local: string): string {
  const [date, time] = local.split("T");
  return `${fmt(date, { day: "numeric", month: "short", year: "numeric" })}, ${time}`;
}
