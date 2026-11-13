"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fold } from "@/lib/domain";
import { ErrorNote, Field, Modal, OkNote, PlusIcon, PrimaryButton, SecondaryButton } from "../../ui";
import { createVolunteer, deleteVolunteer, importVolunteers, type ImportRow, type VolunteerFormState } from "./actions";

/* ------------------------------------------------------------------ */
/* Add one volunteer                                                   */
/* ------------------------------------------------------------------ */

export function AddVolunteer({ nextNumber }: { nextNumber: number }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  return (
    <>
      <PrimaryButton type="button" onClick={() => setOpen(true)}>
        <PlusIcon />
        Adicionar voluntário
      </PrimaryButton>
      {open && <AddForm key={round} nextNumber={nextNumber} onClose={() => setOpen(false)} onAnother={() => setRound((r) => r + 1)} />}
    </>
  );
}

function AddForm({ nextNumber, onClose, onAnother }: { nextNumber: number; onClose: () => void; onAnother: () => void }) {
  const [state, action, pending] = useActionState<VolunteerFormState, FormData>(createVolunteer, {});
  if (state.created) {
    return (
      <Modal title="Voluntário adicionado" onClose={onClose}>
        <div className="flex items-center gap-4 rounded-2xl bg-leaf-soft p-4">
          <span className="text-[44px] font-black leading-none text-leaf-deep">{state.created.number}</span>
          <span className="text-sm font-bold text-leaf-deep">
            Diga a {state.created.name} que o número de voluntário é <b>{state.created.number}</b>. É com ele que faz a entrada no quiosque.
          </span>
        </div>
        <div className="flex justify-end gap-2.5">
          <SecondaryButton type="button" onClick={onClose}>
            Fechar
          </SecondaryButton>
          <PrimaryButton type="button" onClick={onAnother}>
            Adicionar outro
          </PrimaryButton>
        </div>
      </Modal>
    );
  }
  return (
    <Modal title="Adicionar voluntário" onClose={onClose}>
      <form action={action} className="flex flex-col gap-4">
        <div className="flex items-center gap-4 rounded-2xl bg-ground p-4">
          <span className="text-[40px] font-black leading-none">{nextNumber}</span>
          <span className="text-[13px] font-bold text-muted">Número atribuído automaticamente. Diga-o ao voluntário para fazer a entrada no quiosque.</span>
        </div>
        <Field label="Nome">
          <input name="name" required maxLength={120} className="input" autoFocus />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Telefone" hint="(opcional)">
            <input name="phone" type="tel" maxLength={40} className="input" />
          </Field>
          <Field label="Email" hint="(opcional)">
            <input name="email" type="email" maxLength={120} className="input" />
          </Field>
        </div>
        {state.error && <ErrorNote>{state.error}</ErrorNote>}
        <div className="flex justify-end gap-2.5">
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

/* ------------------------------------------------------------------ */
/* Import from CSV / Excel                                             */
/* ------------------------------------------------------------------ */

type Existing = { number: number; name: string };
type Preview = ImportRow & { check: { kind: "novo" } | { kind: "igual" | "parecido" | "repetido"; label: string }; include: boolean };

function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

async function readRows(file: File): Promise<string[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/browser");
    const data = await readSheet(file);
    return data.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c))));
  }
  return parseCsv((await file.text()).replace(/^﻿/, ""));
}

function columns(header: string[]) {
  const h = header.map((x) => fold(x.trim()));
  const find = (...names: string[]) => h.findIndex((x) => names.some((n) => x === n || x.startsWith(n)));
  return { name: find("nome", "name"), phone: find("telefone", "telemovel", "phone", "tel"), email: find("email", "e-mail", "mail") };
}

function distance(a: string, b: string) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

const key = (s: string) => fold(s).replace(/\s+/g, " ").trim();

function buildPreview(rows: string[][], existing: Existing[]): Preview[] {
  if (rows.length === 0) return [];
  let cols = columns(rows[0]);
  let body = rows.slice(1);
  if (cols.name < 0) {
    cols = { name: 0, phone: -1, email: -1 }; // No header: first column is the name.
    body = rows;
  }
  const seen = new Map<string, number>();
  const known = existing.map((e) => ({ ...e, k: key(e.name) }));
  const out: Preview[] = [];
  for (const r of body) {
    const name = (r[cols.name] ?? "").trim().replace(/\s+/g, " ");
    if (!name) continue;
    const k = key(name);
    const row: ImportRow = { name, phone: cols.phone >= 0 ? (r[cols.phone] ?? "").trim() : "", email: cols.email >= 0 ? (r[cols.email] ?? "").trim() : "" };
    const same = known.find((e) => e.k === k);
    const similar = !same && k.length > 4 ? known.find((e) => distance(e.k, k) <= 2) : undefined;
    let check: Preview["check"] = { kind: "novo" };
    if (same) check = { kind: "igual", label: `Igual a n.º ${same.number}` };
    else if (similar) check = { kind: "parecido", label: `Parecido com n.º ${similar.number} (${similar.name})` };
    else if (seen.has(k)) check = { kind: "repetido", label: `Repetido na linha ${seen.get(k)}` };
    seen.set(k, out.length + 1);
    out.push({ ...row, check, include: check.kind === "novo" });
  }
  return out;
}

export function ImportVolunteers({ existing, nextNumber }: { existing: Existing[]; nextNumber: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Preview[] | null>(null);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const [pending, start] = useTransition();

  const close = () => {
    setOpen(false);
    setRows(null);
    setFileName("");
    setError(undefined);
    setDone(undefined);
  };

  const choose = async (file: File | undefined) => {
    setError(undefined);
    if (!file) return;
    setFileName(file.name);
    try {
      const preview = buildPreview(await readRows(file), existing);
      if (preview.length === 0) setError("Não encontrei nomes no ficheiro. A primeira coluna (ou a coluna “Nome”) deve ter os nomes.");
      setRows(preview);
    } catch {
      setError("Não consegui ler o ficheiro. Use CSV ou Excel (.xlsx).");
      setRows(null);
    }
  };

  const selected = rows?.filter((r) => r.include) ?? [];
  const flagged = rows?.filter((r) => r.check.kind !== "novo").length ?? 0;
  let n = nextNumber;

  return (
    <>
      <SecondaryButton type="button" onClick={() => setOpen(true)}>
        Importar
      </SecondaryButton>
      {open && (
        <Modal title="Importar voluntários" onClose={close} wide>
          {done ? (
            <>
              <OkNote>{done}</OkNote>
              <div className="flex justify-end">
                <PrimaryButton type="button" onClick={close}>
                  Fechar
                </PrimaryButton>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-muted">
                Ficheiro CSV ou Excel (.xlsx) com uma coluna <b>Nome</b> e, se quiser, <b>Telefone</b> e <b>Email</b>. Cada pessoa recebe o próximo número livre.
              </p>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-line-strong bg-ground p-4 text-sm font-extrabold">
                <input type="file" accept=".csv,.xlsx,text/csv" className="sr-only" onChange={(e) => void choose(e.target.files?.[0])} />
                {fileName ? `${fileName} · ${rows?.length ?? 0} linhas · trocar ficheiro` : "Escolher ficheiro…"}
              </label>
              {error && <ErrorNote>{error}</ErrorNote>}
              {rows && rows.length > 0 && (
                <>
                  {flagged > 0 && (
                    <p className="rounded-[10px] bg-peach px-3 py-2 text-sm font-bold text-clay">
                      {flagged} {flagged === 1 ? "possível duplicado" : "possíveis duplicados"} — confirme antes de guardar
                    </p>
                  )}
                  <div className="max-h-[46vh] overflow-auto rounded-xl border border-line">
                    <table className="w-full border-collapse text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="text-left text-xs text-muted">
                          <th className="border-b border-line px-3 py-2 font-extrabold">N.º</th>
                          <th className="border-b border-line px-3 py-2 font-extrabold">Nome</th>
                          <th className="border-b border-line px-3 py-2 font-extrabold">Telefone</th>
                          <th className="border-b border-line px-3 py-2 font-extrabold">Email</th>
                          <th className="border-b border-line px-3 py-2 font-extrabold">Verificação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i} className={r.include ? "" : "text-muted"}>
                            <td className="border-b border-line-soft px-3 py-2 font-black">{r.include ? n++ : "—"}</td>
                            <td className="border-b border-line-soft px-3 py-2 font-bold">{r.name}</td>
                            <td className="border-b border-line-soft px-3 py-2">{r.phone || "—"}</td>
                            <td className="border-b border-line-soft px-3 py-2">{r.email || "—"}</td>
                            <td className="border-b border-line-soft px-3 py-2">
                              {r.check.kind === "novo" ? (
                                <span className="font-extrabold text-leaf-deep">Novo</span>
                              ) : (
                                <span className="flex flex-wrap items-center gap-2 font-bold text-clay">
                                  {r.check.label} ·
                                  <label className="flex items-center gap-1 text-ink">
                                    <input
                                      type="checkbox"
                                      checked={r.include}
                                      onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))}
                                      className="accent-leaf"
                                    />
                                    importar mesmo assim
                                  </label>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2.5">
                <SecondaryButton type="button" onClick={close}>
                  Cancelar
                </SecondaryButton>
                <PrimaryButton
                  type="button"
                  disabled={pending || selected.length === 0}
                  onClick={() =>
                    start(async () => {
                      const r = await importVolunteers(selected.map(({ name, phone, email }) => ({ name, phone, email })));
                      if (r.error) setError(r.error);
                      else setDone(`${r.count} voluntários importados (n.º ${r.first} a ${r.last}).`);
                      router.refresh();
                    })
                  }
                >
                  {pending ? "A importar…" : `Importar ${selected.length} voluntários`}
                </PrimaryButton>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Delete (GDPR)                                                       */
/* ------------------------------------------------------------------ */

export function DeleteVolunteer({ id, name }: { id: string; name: string }) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="text-left text-sm font-extrabold text-danger hover:underline">
        Apagar voluntário e histórico (RGPD)
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#e8b4ac] bg-alert-soft p-3">
      <p className="text-sm font-bold text-danger">Apagar {name} e todas as entradas? Não pode ser desfeito. Para deixar de fazer entradas basta desativar.</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => deleteVolunteer(id))}
          className="h-[34px] rounded-lg bg-danger px-3 text-[13px] font-extrabold text-white disabled:opacity-60"
        >
          {pending ? "A apagar…" : "Apagar definitivamente"}
        </button>
        <button type="button" onClick={() => setAsking(false)} className="h-[34px] rounded-lg border border-line-strong bg-white px-3 text-[13px] font-extrabold">
          Cancelar
        </button>
      </div>
    </div>
  );
}
