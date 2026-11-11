import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { BENEFICIARY_TYPE_LABEL, fold, lisbonDate, lisbonTime, padNumber } from "@/lib/domain";
import { formatDay } from "@/lib/period";
import { Card, DownloadIcon, PageHeader, PlusIcon } from "../../ui";

export const metadata: Metadata = { title: "Beneficiários · Refood" };

function lastVisitLabel(iso?: string) {
  if (!iso) return "—";
  const day = lisbonDate(iso);
  const today = lisbonDate();
  if (day === today) return `Hoje, ${lisbonTime(iso)}`;
  return formatDay(day);
}

export default async function BeneficiariesPage({ searchParams }: PageProps<"/admin/beneficiarios">) {
  await requireProfile(["administrador", "gestor_beneficiarios"]);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const tipo = sp.tipo === "familia" || sp.tipo === "individual" ? sp.tipo : "";
  const estado = sp.estado === "inativos" || sp.estado === "todos" ? sp.estado : "ativos";

  const [{ data: rows }, { data: lastVisits }] = await Promise.all([
    db().from("beneficiaries").select("id, number, name, type, adults, children, food_needs, active").order("name"),
    db()
      .from("beneficiary_events")
      .select("beneficiary_id, recorded_at")
      .eq("type", "inscrito")
      .eq("undone", false)
      .order("recorded_at", { ascending: false })
      .limit(5000),
  ]);

  const last = new Map<string, string>();
  for (const v of lastVisits ?? []) if (v.beneficiary_id && !last.has(v.beneficiary_id)) last.set(v.beneficiary_id, v.recorded_at);

  const all = rows ?? [];
  const active = all.filter((b) => b.active);
  const needle = fold(q);
  const list = all.filter(
    (b) =>
      (estado === "todos" || (estado === "ativos" ? b.active : !b.active)) &&
      (!tipo || b.type === tipo) &&
      (!needle || fold(b.name).includes(needle) || padNumber(b.number).includes(needle)),
  );
  const people = active.reduce((n, b) => n + b.adults + b.children, 0);
  const exportHref = `/admin/export/beneficiarios`;

  return (
    <>
      <PageHeader title="Beneficiários" subtitle={`${active.length} inscritos ativos · ${people} pessoas no total`}>
        <a href={exportHref} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line-strong bg-white px-3.5 text-sm font-extrabold hover:bg-ground">
          <DownloadIcon />
          Exportar
        </a>
        <Link href="/admin/beneficiarios/novo" className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-leaf px-4 text-sm font-extrabold text-white hover:bg-leaf-dark">
          <PlusIcon />
          Adicionar beneficiário
        </Link>
      </PageHeader>

      {sp.guardado && (
        <p role="status" className="rounded-[10px] bg-leaf-soft px-3 py-2 text-sm font-bold text-leaf-deep">
          Ficha guardada. O quiosque atualiza em menos de 10 segundos.
        </p>
      )}

      <form className="flex flex-wrap items-center gap-3" action="/admin/beneficiarios">
        <label className="flex h-[42px] max-w-[420px] flex-[1_1_280px] items-center gap-2.5 rounded-[10px] border border-line-strong bg-white px-3.5 text-muted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input name="q" type="search" defaultValue={q} placeholder="Procurar por nome ou número" aria-label="Procurar" className="flex-1 bg-transparent text-[15px] text-ink outline-none" />
        </label>
        <label className="flex h-[42px] items-center gap-2 rounded-[10px] border border-line-strong bg-white px-3 text-sm font-bold">
          Tipo
          <select name="tipo" defaultValue={tipo} className="bg-transparent font-bold">
            <option value="">Todos</option>
            <option value="familia">Família</option>
            <option value="individual">Individual</option>
          </select>
        </label>
        <label className="flex h-[42px] items-center gap-2 rounded-[10px] border border-line-strong bg-white px-3 text-sm font-bold">
          Estado
          <select name="estado" defaultValue={estado} className="bg-transparent font-bold">
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
            <option value="todos">Todos</option>
          </select>
        </label>
        <button type="submit" className="h-[42px] rounded-[10px] bg-ink px-4 text-sm font-extrabold text-white">
          Filtrar
        </button>
      </form>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="border-b border-line px-4 py-3 font-extrabold">N.º</th>
              <th className="border-b border-line px-4 py-3 font-extrabold">Nome ↑</th>
              <th className="border-b border-line px-4 py-3 font-extrabold">Tipo</th>
              <th className="border-b border-line px-4 py-3 text-right font-extrabold">Adultos</th>
              <th className="border-b border-line px-4 py-3 text-right font-extrabold">Crianças</th>
              <th className="border-b border-line px-4 py-3 font-extrabold">Alimentação</th>
              <th className="border-b border-line px-4 py-3 font-extrabold">Último atendimento</th>
              <th className="border-b border-line px-4 py-3 text-right font-extrabold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id} className={b.active ? "" : "text-muted"}>
                <td className="border-b border-line-soft px-4 py-2.5 font-black">{padNumber(b.number)}</td>
                <td className="border-b border-line-soft px-4 py-2.5 font-extrabold">
                  {b.name}
                  {!b.active && <span className="ml-2 rounded-full bg-sand px-2 py-0.5 text-[11px] font-black">inativo</span>}
                </td>
                <td className="border-b border-line-soft px-4 py-2.5 font-bold">{BENEFICIARY_TYPE_LABEL[b.type as "familia"]}</td>
                <td className="border-b border-line-soft px-4 py-2.5 text-right font-extrabold">{b.adults}</td>
                <td className="border-b border-line-soft px-4 py-2.5 text-right font-extrabold">{b.children}</td>
                <td className="border-b border-line-soft px-4 py-2">
                  <span className="flex flex-wrap gap-1">
                    {(b.food_needs ?? []).length > 0 ? (
                      (b.food_needs as string[]).map((d) => (
                        <span key={d} className="rounded-full bg-peach px-2 py-0.5 text-xs font-extrabold text-clay">
                          {d}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </span>
                </td>
                <td className="border-b border-line-soft px-4 py-2.5 font-semibold text-quiet">{lastVisitLabel(last.get(b.id))}</td>
                <td className="border-b border-line-soft px-4 py-2 text-right">
                  <Link
                    href={`/admin/beneficiarios/${b.id}`}
                    aria-label={`Editar ${b.name}`}
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
                <td colSpan={8} className="px-4 py-10 text-center font-bold text-muted">
                  {all.length === 0 ? "Ainda não há beneficiários. Adicione o primeiro." : "Nenhum beneficiário encontrado."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      <p className="text-[13px] font-bold text-muted">A mostrar {list.length} de {all.length} · ordem alfabética</p>
    </>
  );
}
