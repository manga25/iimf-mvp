"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UNAUTHORIZED_MESSAGE } from "@/lib/auth/messages";
import { M } from "@/lib/students/messages";
import type { FieldErrors } from "@/lib/students/types";
import { validateStudent } from "@/lib/students/validation";

/**
 * Validates in the browser for instant feedback, then sends the payload to the API,
 * which validates again (the server is the source of truth). On success, opens the student.
 */
export function useStudentSubmit(studentId: string | null) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); // bumps on every failure so the summary is re-focused
  const [pending, setPending] = useState(false);

  const fail = (message: string, fieldErrors: FieldErrors = {}) => {
    setErrors(fieldErrors);
    setFormError(message);
    setAttempt((n) => n + 1);
    setPending(false);
  };

  async function submit(payload: Record<string, unknown>) {
    const local = validateStudent(payload);
    if (!local.ok) return fail(M.fixErrors, local.errors);

    setPending(true);
    try {
      const res = await fetch(studentId ? `/api/students/${studentId}` : "/api/students", {
        method: studentId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string; errors?: FieldErrors };
      if (res.ok && body.id) {
        router.push(`/students/${body.id}`);
        router.refresh();
        return;
      }
      if (res.status === 401) return fail(UNAUTHORIZED_MESSAGE);
      fail(body.error ?? M.serverError, body.errors ?? {});
    } catch {
      fail(M.network);
    }
  }

  return { submit, errors, formError, attempt, pending };
}
