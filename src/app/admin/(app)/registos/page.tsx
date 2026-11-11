import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { fetchEvents } from "@/lib/events";
import { EVENT_TYPE_LABEL, lisbonDate, lisbonTime, padNumber } from "@/lib/domain";
import { formatDay, resolveRange } from "@/lib/period";
import { Card, DownloadIcon, PageHeader } from "../../ui";
import PeriodPicker from "../period-picker";
import DeleteButton from "./delete-button";

export const metadata: Metadata = { title: "Registos · Refood" };

const LIMIT = 500;

export default async function RecordsPage({ searchParams }: PageProps<"/admin/registos">) {
  await requireProfile(["administrador"]);
  const sp = await searchParams;
  const range = resolveRange(sp.p as string, sp.de as string, sp.ate as string, "hoje");
  const tipo = sp.tipo === "inscrito" || sp.tipo === "nao_inscrito" ? sp.tipo : undefined;
  const anulados = sp.anulados === "1";

  const events = await fetchEvents({ start: range.start, end: range.end, type: tipo, includeUndone: anulados, limit: LIMIT });
  const active = events.filter((e) => !e.undone);
  const undoneCount = events.length - active.length;

  const keep: Record<string, string> = {};
  if (tipo) keep.tipo = tipo;
  if (anulados) keep.anulados = "1";
  const filterHref = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams({ p: range.key, de: range.from, ate: range.to, ...keep });
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) params.delete(k);
      else params.set(k, v);
    }
    return `/admin/registos?${params}`;
  };
  const exportQs = new URLSearchParams({ de: range.from, ate: range.to, ...(anulados ? { anulados: "1" } : {}), ...(tipo ? { tipo } : {}) });

  return (
    <>
      <PageHeader title="Registos" subtitle="Corrija enganos: apagar um registo atualiza os números do quiosque e do painel.">
        <a href={`/admin/export/atendimentos?${exportQs}`} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line-strong bg-white px-4 text-sm font-extrabold hover:bg-ground">
          <DownloadIcon />
          Exportar CSV
        </a>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <PeriodPicker base="/admin/registos" range={range} extra={keep} />
        <div role="group" aria-label="Tipo" className="flex gap-1 rounded-xl border border-line bg-white p-1">
          {[
            [undefined, "Todos"],
            ["nao_inscrito", "Não inscrito"],
            ["inscrito", "Inscrito"],
          ].map(([value, label]) => (
            <Link
              key={label}
              href={filterHref({ tipo: value })}
              className={`flex h-8 items-center rounded-lg px-3 text-[13px] font-extrabold ${tipo === value ? "bg-ink text-white" : "text-quiet hover:bg-ground"}`}
            >
              {label}
            </Link>
          ))}
        </div>
        <Link href={filterHref({ anulados: anulados ? undefined : "1" })} className="flex items-center gap-2 text-sm font-bold">
          <span className={`flex h-5 w-5 items-center justify-center rounded border ${anulados ? "border-leaf bg-leaf text-white" : "border-line-strong bg-white"}`}>
            {anulados && "✓"}
          </span>
          Mostrar anulados
        </Link>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="border-b border-line px-4 py-3 font-extrabold">Data e hora</th>
              <th className="border-b border-line px-4 py-3 font-extrabold">Tipo</th>
              <th className="border-b border-line px-4 py-3 font-extrabold">Beneficiário</th>
              <th className="border-b border-line px-4 py-3 text-right font-extrabold">Pessoas</th>
              <th className="border-b border-line px-4 py-3 font-extrabold">Origem</th>
              <th className="border-b border-line px-4 py-3 text-right font-extrabold">Ação</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const day = lisbonDate(e.recorded_at);
              const when = day === lisbonDate() ? `Hoje, ${lisbonTime(e.recorded_at)}` : `${formatDay(day)}, ${lisbonTime(e.recorded_at)}`;
              return (
                <tr key={e.id} className={e.undone ? "bg-ground text-muted line-through" : ""}>
                  <td className="border-b border-line-soft px-4 py-2.5 font-bold">{when}</td>
                  <td className="border-b border-line-soft px-4 py-2.5 font-bold">
                    {EVENT_TYPE_LABEL[e.type]}
                    {e.undone && " · anulado"}
                  </td>
                  <td className="border-b border-line-soft px-4 py-2.5 font-bold">
                    {e.beneficiaries ? (
                      <>
                        {e.beneficiaries.name} <span className="font-semibold text-muted">n.º {padNumber(e.beneficiaries.number)}</span>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="border-b border-line-soft px-4 py-2.5 text-right font-extrabold">{e.people}</td>
                  <td className="border-b border-line-soft px-4 py-2.5 font-semibold text-quiet">Quiosque {e.kiosk_id.toUpperCase()}</td>
                  <td className="border-b border-line-soft px-4 py-2 text-right">
                    <DeleteButton id={e.id} />
                  </td>
                </tr>
              );
            })}
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center font-bold text-muted">
                  Sem registos neste período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      <p className="text-[13px] font-bold text-muted">
        {active.length} atendimentos · {active.reduce((n, e) => n + e.people, 0)} pessoas
        {anulados && ` · ${undoneCount} anulados no quiosque`}
        {events.length >= LIMIT && ` · a mostrar os ${LIMIT} mais recentes; use o exportar para ver todos`}
      </p>
    </>
  );
}
