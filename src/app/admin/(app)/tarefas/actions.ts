"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { deleteImages, uploadImage } from "@/lib/media";

export type TaskResult = { error?: string };

export async function saveTask(form: FormData): Promise<TaskResult> {
  await requireProfile(["administrador"]);
  const id = String(form.get("id") ?? "");
  const schedule = Number(form.get("schedule")) === 2 ? 2 : 1;
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  const details = String(form.get("details") ?? "").trim().slice(0, 2000);
  if (!name) return { error: "Indique o nome da tarefa." };
  const supabase = db();

  let taskId = id;
  if (id) {
    const { data: old } = await supabase.from("tasks").select("schedule").eq("id", id).maybeSingle();
    if (!old) return { error: "A tarefa já não existe." };
    const patch: Record<string, unknown> = { name, details, schedule };
    if (old.schedule !== schedule) patch.position = await endPosition(schedule);
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) return { error: "Não foi possível guardar." };
  } else {
    const { data, error } = await supabase
      .from("tasks")
      .insert({ name, details, schedule, position: await endPosition(schedule) })
      .select("id")
      .single();
    if (error) return { error: "Não foi possível guardar." };
    taskId = data.id;
  }

  // Photos removed in the dialog.
  const remove = form.getAll("removePhoto").map(String).filter(Boolean);
  if (remove.length) {
    const { data: gone } = await supabase.from("task_photos").select("id, path").eq("task_id", taskId).in("id", remove);
    await deleteImages((gone ?? []).map((p) => p.path));
    await supabase.from("task_photos").delete().eq("task_id", taskId).in("id", remove);
  }
  // New photos.
  for (const f of form.getAll("photos")) {
    if (!(f instanceof File) || f.size === 0) continue;
    try {
      const path = await uploadImage(f, "tasks");
      await supabase.from("task_photos").insert({ task_id: taskId, path });
    } catch (e) {
      return { error: (e as Error).message };
    }
  }
  revalidatePath("/admin/tarefas");
  return {};
}

async function endPosition(schedule: number) {
  const { data } = await db()
    .from("tasks")
    .select("position")
    .eq("schedule", schedule)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1);
  return (data?.[0]?.position ?? -1) + 1;
}

/** Hidden from the lists; past completions stay in the analytics. */
export async function deleteTask(id: string): Promise<TaskResult> {
  await requireProfile(["administrador"]);
  const { error } = await db().from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: "Não foi possível apagar." };
  revalidatePath("/admin/tarefas");
  return {};
}

export async function reorderTasks(ids: string[]): Promise<TaskResult> {
  await requireProfile(["administrador"]);
  const results = await Promise.all(ids.map((id, position) => db().from("tasks").update({ position }).eq("id", id)));
  if (results.some((r) => r.error)) return { error: "Não foi possível reordenar." };
  revalidatePath("/admin/tarefas");
  return {};
}
