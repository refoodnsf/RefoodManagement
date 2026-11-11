"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireProfile, type Role } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";

export type UserActionState = { error?: string; password?: string; email?: string };

function tempPassword() {
  return randomBytes(9).toString("base64url");
}

function role(v: FormDataEntryValue | null): Role {
  return v === "administrador" ? "administrador" : "gestor_beneficiarios";
}

export async function createUser(_prev: UserActionState, form: FormData): Promise<UserActionState> {
  await requireProfile(["administrador"]);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Indique um email válido." };

  const supabase = db();
  const { data: existing } = await supabase.from("profiles").select("user_id").eq("email", email).maybeSingle();
  if (existing) return { error: "Já existe um utilizador com este email." };

  const password = tempPassword();
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  if (error || !data.user) {
    console.error(error);
    return { error: error?.message?.includes("already") ? "Este email já tem conta. Use “Nova palavra-passe” na lista." : "Não foi possível criar o utilizador." };
  }
  const { error: pErr } = await supabase.from("profiles").insert({ user_id: data.user.id, email, name, role: role(form.get("role")) });
  if (pErr) {
    await supabase.auth.admin.deleteUser(data.user.id);
    return { error: "Não foi possível criar o perfil." };
  }
  revalidatePath("/admin/utilizadores");
  return { password, email };
}

export async function changeRole(userId: string, form: FormData) {
  const me = await requireProfile(["administrador"]);
  if (userId === me.userId) return; // Never lock yourself out.
  await db().from("profiles").update({ role: role(form.get("role")) }).eq("user_id", userId);
  revalidatePath("/admin/utilizadores");
}

export async function resetPassword(userId: string): Promise<UserActionState> {
  await requireProfile(["administrador"]);
  const password = tempPassword();
  const { error } = await db().auth.admin.updateUserById(userId, { password });
  if (error) return { error: "Não foi possível definir a palavra-passe." };
  return { password };
}

export async function removeUser(userId: string) {
  const me = await requireProfile(["administrador"]);
  if (userId === me.userId) return;
  await db().auth.admin.deleteUser(userId); // profile row cascades
  revalidatePath("/admin/utilizadores");
}
