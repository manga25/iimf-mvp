"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateLogin } from "@/lib/validation/login";
import { HOME_PATH } from "@/lib/auth/route-access";
import { AUTH_UNAVAILABLE_MESSAGE, INVALID_CREDENTIALS_MESSAGE } from "@/lib/auth/messages";

export type LoginState = { error: string | null; email: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";

  const parsed = validateLogin(rawEmail, formData.get("password"));
  if (!parsed.ok) return { error: parsed.error, email };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      const invalid = error.code === "invalid_credentials" || error.status === 400;
      return { error: invalid ? INVALID_CREDENTIALS_MESSAGE : AUTH_UNAVAILABLE_MESSAGE, email };
    }
  } catch {
    return { error: AUTH_UNAVAILABLE_MESSAGE, email };
  }

  redirect(HOME_PATH);
}
