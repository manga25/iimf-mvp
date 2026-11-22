import "server-only";
import { NextResponse } from "next/server";
import { isUuid } from "@/lib/students/types";
import { PM } from "./messages";
import { setPaymentStatus, type PaymentWriteFailure } from "./repository";
import { validatePaymentStatus } from "./validation";

// PUT /api/payments/[id] { status: "paid", paid_at } | { status: "unpaid" }. Responses:
// 200 { payment } · 400 { error, fields? } invalid input · 404 unknown payment ·
// 409 already has that status · 500 unexpected.

const fail = (status: number, error: string, extra: object = {}) => NextResponse.json({ error, ...extra }, { status });

const FAILURES: Record<PaymentWriteFailure, [number, string]> = {
  not_found: [404, PM.notFound],
  same_status: [409, PM.sameStatus],
  invalid: [400, PM.invalidInput],
  error: [500, PM.serverError],
};

export async function handleSetPaymentStatus(id: string, request: Request): Promise<Response> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail(400, PM.unreadable);
    }
    const input = validatePaymentStatus(body);
    if (!input.ok) return fail(400, Object.values(input.errors)[0] ?? PM.invalidInput, { fields: input.errors });
    if (!isUuid(id)) return fail(404, PM.notFound);

    const saved = await setPaymentStatus(id, input.value);
    if (!saved.ok) {
      const [status, message] = FAILURES[saved.reason];
      return fail(status, message);
    }
    return NextResponse.json({ payment: saved.payment });
  } catch (e) {
    console.error("payments API error:", e);
    return fail(500, PM.serverError);
  }
}
