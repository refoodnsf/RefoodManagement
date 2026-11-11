"use server";

import { requireProfile } from "@/lib/auth";
import { authClient } from "@/lib/supabase/server";

export type PasswordState = { error?: string; ok?: boolean };

export async function changePassword(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  await requireProfile();
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 10) return { error: "A palavra-passe tem de ter pelo menos 10 caracteres." };
  if (password !== confirm) return { error: "As duas palavras-passe não coincidem." };
  const supabase = await authClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Não foi possível mudar a palavra-passe." };
  return { ok: true };
}
