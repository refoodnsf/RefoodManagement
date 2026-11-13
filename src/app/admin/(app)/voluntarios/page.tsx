import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { fold, lisbonDate, lisbonTime } from "@/lib/domain";
import { addDays, formatDay } from "@/lib/period";
import { Card, Chip, DownloadIcon, OkNote, PageHeader, linkButton } from "../../ui";
import { AddVolunteer, ImportVolunteers } from "./client";

export const metadata: Metadata = { title: "Voluntários · Refood" };

function lastLabel(iso?: string) {
  if (!iso) return "—";
  const day = lisbonDate(iso);
  const today = lisbonDate();
  if (day === today) return `Hoje, ${lisbonTime(iso)}`;
  if (day === addDays(today, -1)) return `Ontem, ${lisbonTime(iso)}`;
  return formatDay(day);
}

export default async function VolunteersPage({ searchParams }: PageProps<"/admin/voluntarios">) {
  await requireProfile(["administrador"]);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const estado = sp.estado === "ativos" || sp.estado === "inativos" ? sp.estado : "todos";

  const [{ data: rows }, { data: last }, { data: next }] = await Promise.all([
    db().from("volunteers").select("id, number, name, active").order("name"),
    db().from("check_ins").select("volunteer_id, checked_in_at").order("checked_in_at", { ascending: false }).limit(10000),
    db().rpc("next_volunteer_number"),
  ]);
  const lastBy = new Map<string, string>();
  for (const c of last ?? []) if (!lastBy.has(c.volunteer_id)) lastBy.set(c.volunteer_id, c.checked_in_at);

  const all = rows ?? [];
  const activeCount = all.filter((v) => v.active).length;
  const needle = fold(q);
  const list = all.filter(
    (v) =>
      (estado === "todos" || (estado === "ativos" ? v.active : !v.active)) &&
      (!needle || fold(v.name).includes(needle) || String(v.number) === needle),
  );
  const nextNumber = typeof next === "number" ? next : 1;
  const tabHref = (e: string) => `/admin/voluntarios?${new URLSearchParams({ ...(q ? { q } : {}), ...(e !== "todos" ? { estado: e } : {}) })}`;

  return (
    <>
      <PageHeader
        title="Voluntários"
        subtitle={`${activeCount} ativos · ${all.length - activeCount} inativos · próximo número livre: ${nextNumber}`}
      >
        <a href={`/admin/export/${"voluntarios"}`} className={linkButton}>
          <DownloadIcon />
          Exportar
        </a>
        <Link href="/admin/voluntarios/imprimir" className={linkButton}>
          Imprimir lista
        </Link>
        <ImportVolunteers existing={all.map((v) => ({ number: v.number, name: v.name }))} nextNumber={nextNumber} />
        <AddVolunteer nextNumber={nextNumber} />
      </PageHeader>

      {sp.guardado && <OkNote>Voluntário guardado.</OkNote>}
      {sp.apagado && <OkNote>Voluntário apagado, com o histórico de entradas. O número não volta a ser usado.</OkNote>}

      <div className="flex flex-wrap items-center gap-3">
        <form action="/admin/voluntarios" className="flex max-w-[420px] flex-[1_1_280px]">
          {estado !== "todos" && <input type="hidden" name="estado" value={estado} />}
          <label className="flex h-[42px] flex-1 items-center gap-2.5 rounded-[10px] border border-line-strong bg-white px-3.5 text-muted">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
            <input name="q" type="search" defaultValue={q} placeholder="Procurar por nome ou número" aria-label="Procurar" className="flex-1 bg-transparent text-[15px] text-ink outline-none" />
          </label>
        </form>
        <div role="group" aria-label="Estado" className="flex gap-1 rounded-xl border border-line bg-white p-1">
          {[
            ["todos", "Todos"],
            ["ativos", "Ativos"],
            ["inativos", "Inativos"],
          ].map(([value, label]) => (
            <Link
              key={value}
              href={tabHref(value)}
              aria-current={estado === value ? "page" : undefined}
              className={`flex h-8 items-center rounded-lg px-3 text-[13px] font-extrabold ${estado === value ? "bg-ink text-white" : "text-quiet hover:bg-ground"}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="border-b border-line px-4 py-3 font-extrabold">N.º</th>
              <th className="border-b border-line px-4 py-3 font-extrabold">Nome ↑</th>
              <th className="border-b border-line px-4 py-3 font-extrabold">Estado</th>
              <th className="border-b border-line px-4 py-3 font-extrabold">Última entrada</th>
              <th className="border-b border-line px-4 py-3 text-right font-extrabold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.map((v) => (
              <tr key={v.id} className={v.active ? "" : "text-muted"}>
                <td className="border-b border-line-soft px-4 py-2.5 font-black">{v.number}</td>
                <td className="border-b border-line-soft px-4 py-2.5 font-extrabold">
                  <Link href={`/admin/voluntarios/${v.id}`} className="hover:underline">
                    {v.name}
                  </Link>
                </td>
                <td className="border-b border-line-soft px-4 py-2.5">
                  <Chip tone={v.active ? "green" : "grey"}>{v.active ? "Ativo" : "Inativo"}</Chip>
                </td>
                <td className="border-b border-line-soft px-4 py-2.5 font-semibold text-quiet">{lastLabel(lastBy.get(v.id))}</td>
                <td className="border-b border-line-soft px-4 py-2 text-right">
                  <Link
                    href={`/admin/voluntarios/${v.id}`}
                    aria-label={`Editar ${v.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-line bg-white text-quiet hover:bg-ground"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 20h4L19 9l-4-4L4 16z" />
                    </svg>
                  </Link>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center font-bold text-muted">
                  {all.length === 0 ? "Ainda não há voluntários. Adicione um ou importe uma lista." : "Nenhum voluntário encontrado."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      <p className="text-[13px] font-bold text-muted">
        A mostrar {list.length} de {all.length} · ordem alfabética · os voluntários fazem a entrada no quiosque com o número
      </p>
    </>
  );
}
