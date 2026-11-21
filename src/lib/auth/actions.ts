"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "./route-access";

export async function logout() {
  try {
    const supabase = await createClient();
    // "local" ends only this device's session; other devices stay logged in.
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Even if the auth service is unreachable, send the user to the login page.
  }
  redirect(LOGIN_PATH);
}
