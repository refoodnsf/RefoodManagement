import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { fetchEvents } from "@/lib/events";
import { TZ, lisbonDate, padNumber } from "@/lib/domain";
import { addDays, formatDay, resolveRange } from "@/lib/period";
import { Card, DownloadIcon, PageHeader } from "../ui";
import PeriodPicker from "./period-picker";

export const metadata: Metadata = { title: "Painel · Refood" };

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const fmt = new Intl.NumberFormat("pt-PT");

function lisbonParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  return { weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(wd), hour };
}

export default async function DashboardPage({ searchParams }: PageProps<"/admin">) {
  await requireProfile(["administrador"]);
  const sp = await searchParams;
  const range = resolveRange(sp.p as string, sp.de as string, sp.ate as string, "semana");

  const [events, { data: beneficiaries }] = await Promise.all([
    fetchEvents({ start: range.start, end: range.end }),
    db().from("beneficiaries").select("id, number, name, active, adults, children"),
  ]);

  // KPIs
  const people = events.reduce((n, e) => n + e.people, 0);
  const registered = events.filter((e) => e.type === "inscrito");
  const unregistered = events.length - registered.length;
  const registeredPeople = registered.reduce((n, e) => n + e.people, 0);
  const avgHousehold = registered.length ? registeredPeople / registered.length : 0;
  const uniqueServed = new Set(registered.map((e) => e.beneficiary_id)).size;
  const activeBenef = (beneficiaries ?? []).filter((b) => b.active);

  // People per day, split by type.
  const perDay = new Map(range.days.map((d) => [d, { reg: 0, unreg: 0 }]));
  for (const e of events) {
    const slot = perDay.get(lisbonDate(e.recorded_at));
    if (!slot) continue;
    if (e.type === "inscrito") slot.reg += e.people;
    else slot.unreg += e.people;
  }
  const dayRows = [...perDay.entries()];
  const maxDay = Math.max(1, ...dayRows.map(([, v]) => v.reg + v.unreg));
  const showEvery = Math.ceil(dayRows.length / 16);

  // Busiest weekday × hour (visits).
  const heat = Array.from({ length: 7 }, () => new Map<number, number>());
  let minHour = 24;
  let maxHour = -1;
  for (const e of events) {
    const { weekday, hour } = lisbonParts(e.recorded_at);
    if (weekday < 0) continue;
    heat[weekday].set(hour, (heat[weekday].get(hour) ?? 0) + 1);
    minHour = Math.min(minHour, hour);
    maxHour = Math.max(maxHour, hour);
  }
  const hours = maxHour >= 0 ? Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i) : [];
  const maxHeat = Math.max(1, ...heat.flatMap((m) => [...m.values()]));
  const shades = ["#F1EEE6", "#CFE3D6", "#8EC2A1", "#4E9A6B", "#1E5A38"];
  const shade = (v: number) => (v === 0 ? shades[0] : shades[Math.min(4, 1 + Math.floor(((v - 1) / maxHeat) * 4))]);

  // Most served + registered without a visit for 30+ days.
  const visitsBy = new Map<string, number>();
  for (const e of registered) if (e.beneficiary_id) visitsBy.set(e.beneficiary_id, (visitsBy.get(e.beneficiary_id) ?? 0) + 1);
  const byId = new Map((beneficiaries ?? []).map((b) => [b.id, b]));
  const top = [...visitsBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const since30 = resolveRange("pers", addDays(lisbonDate(), -29), lisbonDate());
  const recent = await db()
    .from("beneficiary_events")
    .select("beneficiary_id")
    .eq("type", "inscrito")
    .eq("undone", false)
    .gte("recorded_at", since30.start.toISOString())
    .limit(10000);
  const recentIds = new Set((recent.data ?? []).map((r) => r.beneficiary_id));
  const absent = activeBenef.filter((b) => !recentIds.has(b.id)).slice(0, 8);

  const exportQs = new URLSearchParams({ de: range.from, ate: range.to }).toString();
  const rangeLabel =
    range.from === range.to ? formatDay(range.from, { day: "numeric", month: "long", year: "numeric" }) : `${formatDay(range.from)} – ${formatDay(range.to, { day: "numeric", month: "short", year: "numeric" })}`;

  const kpis = [
    { label: "Pessoas ajudadas", value: fmt.format(people), sub: `${fmt.format(registeredPeople)} inscritos · ${fmt.format(people - registeredPeople)} não inscritos` },
    { label: "Atendimentos", value: fmt.format(events.length), sub: `${registered.length} inscritos · ${unregistered} não inscritos` },
    { label: "Média por agregado", value: avgHousehold ? avgHousehold.toLocaleString("pt-PT", { maximumFractionDigits: 1 }) : "—", sub: "pessoas por atendimento inscrito" },
    { label: "Beneficiários atendidos", value: fmt.format(uniqueServed), sub: `de ${activeBenef.length} inscritos ativos` },
  ];

  return (
    <>
      <PageHeader title="Painel" subtitle={rangeLabel}>
        <PeriodPicker base="/admin" range={range} />
        <a href={`/admin/export/atendimentos?${exportQs}`} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line-strong bg-white px-4 text-sm font-extrabold hover:bg-ground">
          <DownloadIcon />
          Exportar
        </a>
      </PageHeader>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="flex flex-col gap-1 px-5 py-4">
            <span className="text-[13px] font-extrabold text-muted">{k.label}</span>
            <span className="text-[34px] font-black leading-tight">{k.value}</span>
            <span className="text-[13px] font-bold text-muted">{k.sub}</span>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(420px,1fr))] gap-4">
        <Card className="flex flex-col gap-3.5 px-6 py-5">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="mr-auto text-[17px] font-black">Pessoas ajudadas por dia</h2>
            <span className="flex items-center gap-1.5 text-[13px] font-bold">
              <span className="h-3 w-3 rounded-[3px] bg-leaf" />
              Inscrito
            </span>
            <span className="flex items-center gap-1.5 text-[13px] font-bold">
              <span className="h-3 w-3 rounded-[3px] bg-orange" />
              Não inscrito
            </span>
          </div>
          <div className="flex h-[200px] items-end gap-1 border-b border-line">
            {dayRows.map(([d, v]) => (
              <div key={d} title={`${formatDay(d)}: ${v.reg} inscrito, ${v.unreg} não inscrito`} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-[2px]">
                {v.unreg > 0 && <span className="block rounded-t-[4px] bg-orange" style={{ height: `${(v.unreg / maxDay) * 196}px` }} />}
                {v.reg > 0 && <span className={`block bg-leaf ${v.unreg ? "" : "rounded-t-[4px]"}`} style={{ height: `${(v.reg / maxDay) * 196}px` }} />}
              </div>
            ))}
          </div>
          <div className="flex gap-1 text-[11px] font-bold text-muted">
            {dayRows.map(([d], i) => (
              <span key={d} className="min-w-0 flex-1 text-center">
                {i % showEvery === 0 ? d.slice(8) : ""}
              </span>
            ))}
          </div>
          <span className="text-xs font-bold text-muted">Máximo num dia: {maxDay === 1 && people === 0 ? 0 : maxDay} pessoas</span>
        </Card>

        <Card className="flex flex-col gap-3 px-6 py-5">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="mr-auto text-[17px] font-black">Dias e horas com mais movimento</h2>
            <span className="text-[13px] font-bold text-muted">Atendimentos</span>
          </div>
          {hours.length === 0 ? (
            <p className="py-10 text-center text-sm font-bold text-muted">Sem atendimentos neste período.</p>
          ) : (
            <>
              <div className="grid gap-1 text-[11px] font-bold text-muted" style={{ gridTemplateColumns: `40px repeat(${hours.length}, minmax(0, 1fr))` }}>
                <span />
                {hours.map((h) => (
                  <span key={h} className="text-center">
                    {h}h
                  </span>
                ))}
                {WEEKDAYS.map((w, r) => (
                  <Row key={w} label={w} cells={hours.map((h) => ({ h, v: heat[r].get(h) ?? 0 }))} shade={shade} />
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
                Menos
                {shades.map((c) => (
                  <span key={c} className="h-3 w-[18px] rounded-[3px]" style={{ background: c }} />
                ))}
                Mais
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
        <SmallTable
          title="Beneficiários mais atendidos"
          c1="Beneficiário"
          c2="Atendimentos"
          rows={top.map(([id, n]) => {
            const b = byId.get(id);
            return { a: b?.name ?? "—", b: b ? `n.º ${padNumber(b.number)}` : "", c: String(n) };
          })}
          empty="Sem atendimentos de inscritos neste período."
        />
        <SmallTable
          title="Inscritos sem atendimento há 30+ dias"
          c1="Beneficiário"
          c2="Agregado"
          rows={absent.map((b) => ({ a: b.name, b: `n.º ${padNumber(b.number)}`, c: `${b.adults + b.children} pessoas` }))}
          empty="Todos os inscritos ativos vieram nos últimos 30 dias."
        />
      </div>
    </>
  );
}

function Row({ label, cells, shade }: { label: string; cells: { h: number; v: number }[]; shade: (v: number) => string }) {
  return (
    <>
      <span className="flex items-center">{label}</span>
      {cells.map((c) => (
        <span key={c.h} title={`${label} ${c.h}h: ${c.v} atendimentos`} className="h-[26px] rounded-[5px]" style={{ background: shade(c.v) }} />
      ))}
    </>
  );
}

function SmallTable({ title, c1, c2, rows, empty }: { title: string; c1: string; c2: string; rows: { a: string; b: string; c: string }[]; empty: string }) {
  return (
    <Card className="flex min-w-0 flex-col gap-2.5 px-5 py-4">
      <h2 className="text-base font-black">{title}</h2>
      {rows.length === 0 ? (
        <p className="py-4 text-sm font-bold text-muted">{empty}</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-line px-1.5 py-2 text-left text-xs font-extrabold text-muted">{c1}</th>
              <th className="border-b border-line px-1.5 py-2 text-right text-xs font-extrabold text-muted">{c2}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="border-b border-line-soft px-1.5 py-2 font-bold">
                  {r.a} <span className="font-semibold text-muted">{r.b}</span>
                </td>
                <td className="border-b border-line-soft px-1.5 py-2 text-right font-extrabold">{r.c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
