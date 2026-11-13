import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { mediaUrl } from "@/lib/media";
import { PageHeader } from "../../ui";
import Board, { type AdminTask } from "./board";

export const metadata: Metadata = { title: "Tarefas · Refood" };

export default async function TasksPage() {
  await requireProfile(["administrador"]);
  const { data } = await db()
    .from("tasks")
    .select("id, schedule, name, details, position, created_at, task_photos(id, path, uploaded_at)")
    .is("deleted_at", null)
    .order("position")
    .order("created_at");
  const tasks: AdminTask[] = (data ?? []).map((t) => ({
    id: t.id,
    schedule: t.schedule,
    name: t.name,
    details: t.details ?? "",
    photos: ((t.task_photos ?? []) as { id: string; path: string; uploaded_at: string }[])
      .sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at))
      .map((p) => ({ id: p.id, url: mediaUrl(p.path)! })),
  }));
  return (
    <>
      <PageHeader title="Tarefas" subtitle="Arraste para reordenar. Os detalhes e as fotos aparecem em “Ver detalhes” no quiosque; as alterações chegam lá em menos de 10 segundos." />
      <Board tasks={tasks} />
      <p className="text-[13px] font-bold text-muted">Apagar uma tarefa não remove as conclusões anteriores do painel de análise.</p>
    </>
  );
}
