"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { FOOD_OPTIONS } from "@/lib/domain";

export type BeneficiaryFormState = { error?: string };

function int(v: FormDataEntryValue | null, fallback: number) {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function parse(form: FormData) {
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  const type = form.get("type") === "individual" ? "individual" : "familia";
  const adults = int(form.get("adults"), 1);
  const children = int(form.get("children"), 0);
  const allowed = new Set<string>(FOOD_OPTIONS);
  const food_needs = form.getAll("food_needs").map(String).filter((f) => allowed.has(f));
  const food_notes = String(form.get("food_notes") ?? "").trim().slice(0, 500);
  return { name, type, adults, children, food_needs, food_notes };
}

function validate(v: ReturnType<typeof parse>): string | undefined {
  if (!v.name) return "Indique o nome.";
  if (v.name.length > 120) return "O nome é demasiado longo.";
  if (v.adults < 0 || v.adults > 30 || v.children < 0 || v.children > 30) return "O número de adultos e crianças tem de estar entre 0 e 30.";
  if (v.adults + v.children < 1) return "O agregado tem de ter pelo menos 1 pessoa.";
}

export async function createBeneficiary(_prev: BeneficiaryFormState, form: FormData): Promise<BeneficiaryFormState> {
  await requireProfile(["administrador", "gestor_beneficiarios"]);
  const values = parse(form);
  const error = validate(values);
  if (error) return { error };
  const { error: dbError } = await db().from("beneficiaries").insert(values);
  if (dbError) {
    console.error(dbError);
    return { error: "Não foi possível guardar. Tente novamente." };
  }
  revalidatePath("/admin/beneficiarios");
  redirect("/admin/beneficiarios?guardado=1");
}

export async function updateBeneficiary(id: string, _prev: BeneficiaryFormState, form: FormData): Promise<BeneficiaryFormState> {
  await requireProfile(["administrador", "gestor_beneficiarios"]);
  const values = parse(form);
  const error = validate(values);
  if (error) return { error };
  const active = form.get("active") === "on";
  const { error: dbError } = await db().from("beneficiaries").update({ ...values, active }).eq("id", id);
  if (dbError) {
    console.error(dbError);
    return { error: "Não foi possível guardar. Tente novamente." };
  }
  revalidatePath("/admin/beneficiarios");
  redirect("/admin/beneficiarios?guardado=1");
}
