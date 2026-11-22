import { ensurePayments } from "@/lib/payments/sync";

/** Runs the lazy payment generation on every authenticated page load (SPEC §3.7). Renders nothing. */
export async function PaymentSync() {
  await ensurePayments();
  return null;
}
