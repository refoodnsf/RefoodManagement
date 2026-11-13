import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { SCHEDULE_LABEL, initials, lisbonDate, lisbonTime, type Schedule } from "@/lib/domain";
import { addDays, formatDay } from "@/lib/period";
import { Card, PageHeader } from "../../../ui";
import VolunteerForm from "../form";
import { DeleteVolunteer } from "../client";
import { updateVolunteer } from "../actions";

export const metadata: Metadata = { title: "Voluntário · Refood" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function VolunteerPage({ params }: PageProps<"/admin/voluntarios/[id]">) {
  await requireProfile(["administrador"]);
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [{ data: v }, { data: visits }] = await Promise.all([
    db().from("volunteers").select("*").eq("id", id).maybeSingle(),
    db().from("check_ins").select("id, checked_in_at, schedule").eq("volunteer_id", id).order("checked_in_at", { ascending: false }).limit(200),
  ]);
  if (!v) notFound();

  const since = addDays(lisbonDate(), -29);
  const last30 = (visits ?? []).filter((c) => lisbonDate(c.checked_in_at) >= since).length;
  const bySchedule = [1, 2].map((s) => (visits ?? []).filter((c) => c.schedule === s).length);
  const usual = visits?.length ? (bySchedule[0] >= bySchedule[1] ? "1.º" : "2.º") : "—";
  const since_ = formatDay(lisbonDate(v.created_at), { month: "short", year: "numeric" });

  return (
    <>
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-leaf-soft text-xl font-black text-leaf-deep">{initials(v.name)}</span>
        <PageHeader title={v.name} subtitle={`N.º ${v.number} · ${v.active ? "Ativo" : "Inativo"} · desde ${since_}`} />
      </div>
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex w-full max-w-[560px] flex-col gap-4">
          <VolunteerForm
            action={updateVolunteer.bind(null, id)}
            initial={{ number: v.number, name: v.name, phone: v.phone ?? "", email: v.email ?? "", active: v.active }}
          />
          <DeleteVolunteer id={id} name={v.name} />
        </div>
        <Card className="flex w-full max-w-[380px] flex-col gap-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-ground p-3">
              <span className="block text-xs font-extrabold text-muted">Entradas (30 dias)</span>
              <span className="text-[26px] font-black">{last30}</span>
            </div>
            <div className="rounded-xl bg-ground p-3">
              <span className="block text-xs font-extrabold text-muted">Turno habitual</span>
              <span className="text-[26px] font-black">{usual}</span>
            </div>
          </div>
          <h2 className="text-base font-black">Histórico de entradas</h2>
          {visits && visits.length > 0 ? (
            <ul className="flex flex-col divide-y divide-line-soft text-sm">
              {visits.map((c) => (
                <li key={c.id} className="flex justify-between py-2 font-bold">
                  <span>{formatDay(lisbonDate(c.checked_in_at), { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
                  <span className="text-quiet">
                    {lisbonTime(c.checked_in_at)} · {SCHEDULE_LABEL[c.schedule as Schedule].pt}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm font-semibold text-muted">Ainda sem entradas.</p>
          )}
        </Card>
      </div>
    </>
  );
}
