"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { deleteImages, imageFrom, uploadImage } from "@/lib/media";

export type EventResult = { error?: string };
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export async function saveEvent(form: FormData): Promise<EventResult> {
  await requireProfile(["administrador"]);
  const id = String(form.get("id") ?? "");
  const title = String(form.get("title") ?? "").trim().slice(0, 120);
  const body = String(form.get("body") ?? "").trim().slice(0, 400);
  const qr_link = String(form.get("qr_link") ?? "").trim().slice(0, 500);
  const starts_on = String(form.get("starts_on") ?? "");
  const ends_on = String(form.get("ends_on") ?? "");
  if (!title) return { error: "Indique o título." };
  if (!YMD.test(starts_on) || !YMD.test(ends_on)) return { error: "Indique as datas de início e fim." };
  if (ends_on < starts_on) return { error: "A data de fim não pode ser antes do início." };
  if (qr_link && !/^https?:\/\/\S+$/i.test(qr_link)) return { error: "O link do QR tem de começar por http:// ou https://" };

  const supabase = db();
  const { data: old } = id ? await supabase.from("events").select("image_path").eq("id", id).maybeSingle() : { data: null };
  let image_path: string | null = old?.image_path ?? null;
  const file = imageFrom(form, "image");
  try {
    if (file) image_path = await uploadImage(file, "events");
  } catch (e) {
    return { error: (e as Error).message };
  }
  if ((file || form.get("removeImage") === "1") && old?.image_path) {
    await deleteImages([old.image_path]);
    if (!file) image_path = null;
  }

  const values = { title, body, qr_link, starts_on, ends_on, image_path };
  const { error } = id ? await supabase.from("events").update(values).eq("id", id) : await supabase.from("events").insert(values);
  if (error) {
    console.error(error);
    return { error: "Não foi possível guardar." };
  }
  revalidatePath("/admin/eventos");
  redirect("/admin/eventos?guardado=1");
}

export async function deleteEvent(id: string): Promise<EventResult> {
  await requireProfile(["administrador"]);
  const { data: old } = await db().from("events").select("image_path").eq("id", id).maybeSingle();
  const { error } = await db().from("events").delete().eq("id", id);
  if (error) return { error: "Não foi possível apagar." };
  await deleteImages([old?.image_path]);
  revalidatePath("/admin/eventos");
  redirect("/admin/eventos?apagado=1");
}
