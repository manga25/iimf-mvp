"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UNAUTHORIZED_MESSAGE } from "@/lib/auth/messages";
import { CM } from "@/lib/calendar/messages";

export type ApiFailure = { error: string; fields?: Record<string, string> };

/**
 * Sends a JSON request to a calendar API route and refreshes the page on success.
 * `pending` stays true until the refreshed server data has arrived.
 */
export function useApiAction() {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  async function run(method: "POST" | "DELETE", path: string, body?: unknown): Promise<boolean> {
    setSending(true);
    setFailure(null);
    try {
      const res = await fetch(path, {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as Partial<ApiFailure>;
        setFailure(res.status === 401 ? { error: UNAUTHORIZED_MESSAGE } : { error: data.error ?? CM.serverError, fields: data.fields });
        return false;
      }
      startTransition(() => router.refresh());
      return true;
    } catch {
      setFailure({ error: CM.network });
      return false;
    } finally {
      setSending(false);
    }
  }

  return { run, pending: sending || refreshing, failure, error: failure?.error ?? null, clear: () => setFailure(null) };
}
