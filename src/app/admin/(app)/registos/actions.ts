"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";

export async function deleteEvent(id: string) {
  await requireProfile(["administrador"]);
  const { error } = await db().from("beneficiary_events").delete().eq("id", id);
  if (error) throw new Error("Não foi possível apagar o registo.");
  revalidatePath("/admin/registos");
  revalidatePath("/admin");
}

export async function deleteCheckIn(id: string) {
  await requireProfile(["administrador"]);
  const { error } = await db().from("check_ins").delete().eq("id", id);
  if (error) throw new Error("Não foi possível apagar o registo.");
  revalidatePath("/admin/registos");
  revalidatePath("/admin");
}
