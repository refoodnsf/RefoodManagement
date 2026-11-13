"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";

export type ContactResult = { error?: string };

const clean = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

export async function saveContact(form: FormData): Promise<ContactResult> {
  await requireProfile(["administrador"]);
  const id = String(form.get("id") ?? "");
  const values = { name: clean(form.get("name"), 80), phone: clean(form.get("phone"), 40), note: clean(form.get("note"), 80) };
  if (!values.name) return { error: "Indique o nome." };
  if (!values.phone) return { error: "Indique o telefone." };
  const supabase = db();
  if (id) {
    const { error } = await supabase.from("emergency_contacts").update(values).eq("id", id);
    if (error) return { error: "Não foi possível guardar." };
  } else {
    const { data: last } = await supabase.from("emergency_contacts").select("position").order("position", { ascending: false }).limit(1);
    const { error } = await supabase.from("emergency_contacts").insert({ ...values, position: (last?.[0]?.position ?? -1) + 1 });
    if (error) return { error: "Não foi possível guardar." };
  }
  revalidatePath("/admin/contactos");
  return {};
}

export async function deleteContact(id: string): Promise<ContactResult> {
  await requireProfile(["administrador"]);
  const { error } = await db().from("emergency_contacts").delete().eq("id", id);
  if (error) return { error: "Não foi possível apagar." };
  revalidatePath("/admin/contactos");
  return {};
}

export async function reorderContacts(ids: string[]): Promise<ContactResult> {
  await requireProfile(["administrador"]);
  const results = await Promise.all(ids.map((id, position) => db().from("emergency_contacts").update({ position }).eq("id", id)));
  if (results.some((r) => r.error)) return { error: "Não foi possível reordenar." };
  revalidatePath("/admin/contactos");
  return {};
}
