"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UNAUTHORIZED_MESSAGE } from "@/lib/auth/messages";
import { SM } from "@/lib/schedule/messages";

/**
 * POSTs to a /api/schedule route and refreshes the page on success.
 * `pending` stays true until the refreshed server data has arrived.
 */
export function useScheduleAction() {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function run(path: string, body?: unknown): Promise<boolean> {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(res.status === 401 ? UNAUTHORIZED_MESSAGE : (data.error ?? SM.serverError));
        return false;
      }
      startTransition(() => router.refresh());
      return true;
    } catch {
      setError(SM.network);
      return false;
    } finally {
      setSending(false);
    }
  }

  return { run, pending: sending || refreshing, error, clearError: () => setError(null) };
}
