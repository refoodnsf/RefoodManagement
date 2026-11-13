"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { deleteImages, uploadImage } from "@/lib/media";

export type PhotoResult = { error?: string; count?: number };

/** Photos uploaded in System 3 are permanent (no expiry). */
export async function uploadPhotos(form: FormData): Promise<PhotoResult> {
  await requireProfile(["administrador"]);
  let count = 0;
  for (const f of form.getAll("photos")) {
    if (!(f instanceof File) || f.size === 0) continue;
    try {
      const path = await uploadImage(f, "admin");
      const { error } = await db().from("photos").insert({ path, source: "admin" });
      if (error) throw new Error("Não foi possível guardar a foto.");
      count++;
    } catch (e) {
      revalidatePath("/admin/fotos");
      return { error: (e as Error).message, count };
    }
  }
  revalidatePath("/admin/fotos");
  return { count };
}

export async function setPhotoHidden(id: string, hidden: boolean): Promise<PhotoResult> {
  await requireProfile(["administrador"]);
  const { error } = await db().from("photos").update({ hidden }).eq("id", id);
  if (error) return { error: "Não foi possível alterar." };
  revalidatePath("/admin/fotos");
  return {};
}

export async function deletePhoto(id: string): Promise<PhotoResult> {
  await requireProfile(["administrador"]);
  const { data } = await db().from("photos").select("path").eq("id", id).maybeSingle();
  const { error } = await db().from("photos").delete().eq("id", id);
  if (error) return { error: "Não foi possível apagar." };
  await deleteImages([data?.path]);
  revalidatePath("/admin/fotos");
  return {};
}
