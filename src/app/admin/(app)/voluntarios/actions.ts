"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";

export type VolunteerFormState = { error?: string; created?: { number: number; name: string } };

function clean(v: FormDataEntryValue | null, max: number) {
  return String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function parse(form: FormData) {
  return { name: clean(form.get("name"), 120), phone: clean(form.get("phone"), 40), email: clean(form.get("email"), 120).toLowerCase() };
}

function validate(v: { name: string; email: string }) {
  if (!v.name) return "Indique o nome.";
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return "O email não parece válido.";
}

export async function createVolunteer(_prev: VolunteerFormState, form: FormData): Promise<VolunteerFormState> {
  await requireProfile(["administrador"]);
  const values = parse(form);
  const error = validate(values);
  if (error) return { error };
  const { data, error: dbError } = await db().from("volunteers").insert(values).select("number, name").single();
  if (dbError) {
    console.error(dbError);
    return { error: "Não foi possível guardar. Tente novamente." };
  }
  revalidatePath("/admin/voluntarios");
  return { created: { number: data.number, name: data.name } };
}

export async function updateVolunteer(id: string, _prev: VolunteerFormState, form: FormData): Promise<VolunteerFormState> {
  await requireProfile(["administrador"]);
  const values = parse(form);
  const error = validate(values);
  if (error) return { error };
  const active = form.get("active") === "on";
  const { error: dbError } = await db().from("volunteers").update({ ...values, active }).eq("id", id);
  if (dbError) {
    console.error(dbError);
    return { error: "Não foi possível guardar. Tente novamente." };
  }
  revalidatePath("/admin/voluntarios");
  redirect("/admin/voluntarios?guardado=1");
}

/** GDPR erasure: removes the volunteer and their check-ins. The number is not reused. */
export async function deleteVolunteer(id: string) {
  await requireProfile(["administrador"]);
  const { error } = await db().from("volunteers").delete().eq("id", id);
  if (error) throw new Error("Não foi possível apagar o voluntário.");
  revalidatePath("/admin/voluntarios");
  redirect("/admin/voluntarios?apagado=1");
}

export type ImportRow = { name: string; phone: string; email: string };

export async function importVolunteers(rows: ImportRow[]): Promise<{ error?: string; count?: number; first?: number; last?: number }> {
  await requireProfile(["administrador"]);
  const values = rows
    .map((r) => ({
      name: String(r.name ?? "").trim().replace(/\s+/g, " ").slice(0, 120),
      phone: String(r.phone ?? "").trim().slice(0, 40),
      email: String(r.email ?? "").trim().toLowerCase().slice(0, 120),
    }))
    .filter((r) => r.name);
  if (values.length === 0) return { error: "Não há nomes para importar." };
  if (values.length > 2000) return { error: "No máximo 2000 voluntários de cada vez." };
  // Insert one by one so numbers follow the file order.
  const numbers: number[] = [];
  for (const v of values) {
    const { data, error } = await db().from("volunteers").insert(v).select("number").single();
    if (error) {
      console.error(error);
      revalidatePath("/admin/voluntarios");
      return { error: `Parou na linha "${v.name}". ${numbers.length} voluntários já foram importados.`, count: numbers.length };
    }
    numbers.push(data.number);
  }
  revalidatePath("/admin/voluntarios");
  return { count: numbers.length, first: numbers[0], last: numbers[numbers.length - 1] };
}
