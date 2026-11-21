"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "./route-access";

export async function logout() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Even if the auth service is unreachable, send the user to the login page.
  }
  redirect(LOGIN_PATH);
}
