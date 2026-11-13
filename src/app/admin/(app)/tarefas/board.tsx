"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { shrinkImage } from "@/lib/image-client";
import { ErrorNote, Field, Modal, PlusIcon, PrimaryButton, SecondaryButton } from "../../ui";
import { deleteTask, reorderTasks, saveTask } from "./actions";

export type AdminTask = { id: string; schedule: number; name: string; details: string; photos: { id: string; url: string }[] };

const COLUMNS = [
  { schedule: 1, name: "1.º Turno", hours: "até às 20:00" },
  { schedule: 2, name: "2.º Turno", hours: "20:00 – 24:00" },
];

export default function Board({ tasks }: { tasks: AdminTask[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminTask | { schedule: number } | null>(null);
  const [order, setOrder] = useState<Record<number, string[]> | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [, start] = useTransition();

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const ids = (s: number) => order?.[s] ?? tasks.filter((t) => t.schedule === s).map((t) => t.id);

  const moveTo = (s: number, targetId: string | null) => {
    if (!dragging) return;
    const list = ids(s).filter((x) => x !== dragging);
    if (byId.get(dragging)?.schedule !== s) return; // Use "Editar" to move between schedules.
    const at = targetId ? list.indexOf(targetId) : list.length;
    list.splice(at < 0 ? list.length : at, 0, dragging);
    setOrder({ ...(order ?? {}), [s]: list });
  };

  const commit = (s: number) => {
    setDragging(null);
    const list = order?.[s];
    if (!list) return;
    start(async () => {
      await reorderTasks(list);
      router.refresh();
      setOrder(null);
    });
  };

  const move = (s: number, id: string, delta: number) => {
    const list = [...ids(s)];
    const i = list.indexOf(id);
    const j = i + delta;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setOrder({ ...(order ?? {}), [s]: list });
    start(async () => {
      await reorderTasks(list);
      router.refresh();
      setOrder(null);
    });
  };

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-5">
        {COLUMNS.map((col) => {
          const list = ids(col.schedule).map((id) => byId.get(id)!).filter(Boolean);
          return (
            <section key={col.schedule} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5">
              <div className="flex items-baseline gap-2.5">
                <h2 className="text-[19px] font-black">{col.name}</h2>
                <span className="text-[13px] font-bold text-muted">{col.hours}</span>
                <span className="ml-auto rounded-full bg-leaf-soft px-2.5 py-0.5 text-xs font-extrabold text-leaf-deep">{list.length} tarefas</span>
              </div>
              <ol className="flex flex-col gap-1.5" onDragOver={(e) => e.preventDefault()} onDrop={() => commit(col.schedule)}>
                {list.map((t, i) => (
                  <li
                    key={t.id}
                    draggable
                    onDragStart={() => setDragging(t.id)}
                    onDragEnter={() => moveTo(col.schedule, t.id)}
                    onDragEnd={() => commit(col.schedule)}
                    className={`group flex min-h-14 items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 ${
                      dragging === t.id ? "border-2 border-leaf bg-white shadow-[0_8px_20px_rgba(31,42,34,.12)]" : "border border-[#ede7db] bg-ground"
                    }`}
                  >
                    <span aria-hidden="true" className="cursor-grab text-muted">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="9" cy="6" r="1.6" />
                        <circle cx="15" cy="6" r="1.6" />
                        <circle cx="9" cy="12" r="1.6" />
                        <circle cx="15" cy="12" r="1.6" />
                        <circle cx="9" cy="18" r="1.6" />
                        <circle cx="15" cy="18" r="1.6" />
                      </svg>
                    </span>
                    <span className="w-5 text-right text-[13px] font-black text-muted">{i + 1}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-extrabold">{t.name}</span>
                      <span className="flex gap-1.5 text-xs font-bold text-muted">
                        {t.details && <span>Com detalhes</span>}
                        {t.photos.length > 0 && <span>· {t.photos.length} {t.photos.length === 1 ? "foto" : "fotos"}</span>}
                      </span>
                    </span>
                    <span className="flex gap-1 opacity-60 group-hover:opacity-100">
                      <IconButton label="Subir" onClick={() => move(col.schedule, t.id, -1)} d="M6 15l6-6 6 6" />
                      <IconButton label="Descer" onClick={() => move(col.schedule, t.id, 1)} d="M6 9l6 6 6-6" />
                      <IconButton label={`Editar ${t.name}`} onClick={() => setEditing(t)} d="M4 20h4L19 9l-4-4L4 16z" />
                    </span>
                  </li>
                ))}
                {list.length === 0 && <li className="rounded-[10px] bg-ground px-3 py-6 text-center text-sm font-bold text-muted">Sem tarefas neste turno.</li>}
              </ol>
              <button
                type="button"
                onClick={() => setEditing({ schedule: col.schedule })}
                className="flex h-11 items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-line-strong text-sm font-extrabold text-leaf-link hover:bg-ground"
              >
                <PlusIcon />
                Adicionar tarefa
              </button>
            </section>
          );
        })}
      </div>
      {editing && (
        <TaskDialog
          task={"id" in editing ? editing : null}
          schedule={editing.schedule}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function IconButton({ label, onClick, d }: { label: string; onClick: () => void; d: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-quiet hover:bg-ground">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
    </button>
  );
}

function TaskDialog({ task, schedule, onClose, onSaved }: { task: AdminTask | null; schedule: number; onClose: () => void; onSaved: () => void }) {
  const [removed, setRemoved] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const kept = task?.photos.filter((p) => !removed.includes(p.id)) ?? [];

  const submit = (form: HTMLFormElement) =>
    start(async () => {
      setError(undefined);
      const data = new FormData(form);
      data.delete("photos");
      for (const f of files) data.append("photos", await shrinkImage(f));
      for (const id of removed) data.append("removePhoto", id);
      if (task) data.set("id", task.id);
      const r = await saveTask(data);
      if (r.error) setError(r.error);
      else onSaved();
    });

  return (
    <Modal title={task ? "Editar tarefa" : "Nova tarefa"} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(e.currentTarget);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <Field label="Nome da tarefa">
            <input name="name" required maxLength={120} defaultValue={task?.name} className="input" autoFocus />
          </Field>
          <Field label="Turno">
            <select name="schedule" defaultValue={schedule} className="input">
              <option value={1}>1.º Turno</option>
              <option value={2}>2.º Turno</option>
            </select>
          </Field>
        </div>
        <Field label="Detalhes" hint="(aparecem em “Ver detalhes”)">
          <textarea name="details" rows={4} maxLength={2000} defaultValue={task?.details} className="input" />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-extrabold">
            Fotografias <span className="font-semibold text-muted">· guardadas até serem apagadas</span>
          </span>
          <div className="grid grid-cols-3 gap-2">
            {kept.map((p) => (
              <div key={p.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-24 w-full rounded-[10px] object-cover" />
                <button type="button" onClick={() => setRemoved([...removed, p.id])} className="absolute right-1 top-1 rounded-md bg-white/90 px-1.5 text-xs font-black text-danger">
                  Remover
                </button>
              </div>
            ))}
            {files.map((f, i) => (
              <div key={i} className="relative flex h-24 items-center justify-center rounded-[10px] bg-leaf-soft p-2 text-center text-xs font-bold text-leaf-deep">
                {f.name}
                <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-md bg-white/90 px-1.5 text-xs font-black text-danger">
                  ×
                </button>
              </div>
            ))}
            <label className="flex h-24 cursor-pointer items-center justify-center rounded-[10px] border-2 border-dashed border-line-strong text-sm font-extrabold text-leaf-link hover:bg-ground">
              + Adicionar
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 8));
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex flex-wrap items-center gap-2.5">
          {task &&
            (confirmDelete ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await deleteTask(task.id);
                    if (r.error) setError(r.error);
                    else onSaved();
                  })
                }
                className="h-10 rounded-[10px] bg-danger px-3 text-sm font-extrabold text-white"
              >
                Confirmar apagar
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="h-10 rounded-[10px] px-2 text-sm font-extrabold text-danger hover:bg-alert-soft">
                Apagar tarefa
              </button>
            ))}
          <span className="flex-1" />
          <SecondaryButton type="button" onClick={onClose}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={pending}>
            {pending ? "A guardar…" : "Guardar"}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
