import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { lisbonDate, lisbonTime, padNumber } from "@/lib/domain";
import { formatDay } from "@/lib/period";
import { Card, PageHeader } from "../../../ui";
import BeneficiaryForm from "../form";
import { updateBeneficiary } from "../actions";

export const metadata: Metadata = { title: "Beneficiário · Refood" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function EditBeneficiaryPage({ params }: PageProps<"/admin/beneficiarios/[id]">) {
  await requireProfile(["administrador", "gestor_beneficiarios"]);
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [{ data: b }, { data: visits }] = await Promise.all([
    db().from("beneficiaries").select("*").eq("id", id).maybeSingle(),
    db()
      .from("beneficiary_events")
      .select("id, recorded_at, people, undone")
      .eq("beneficiary_id", id)
      .order("recorded_at", { ascending: false })
      .limit(20),
  ]);
  if (!b) notFound();

  return (
    <>
      <PageHeader title={b.name} subtitle={`N.º ${padNumber(b.number)}`} />
      <div className="flex flex-wrap items-start gap-5">
        <BeneficiaryForm
          action={updateBeneficiary.bind(null, id)}
          initial={{
            number: b.number,
            name: b.name,
            type: b.type,
            adults: b.adults,
            children: b.children,
            food_needs: b.food_needs ?? [],
            food_notes: b.food_notes ?? "",
            active: b.active,
          }}
        />
        <Card className="w-full max-w-[360px] p-5">
          <h2 className="mb-3 text-base font-black">Últimos atendimentos</h2>
          {visits && visits.length > 0 ? (
            <ul className="flex flex-col divide-y divide-line-soft text-sm">
              {visits.map((v) => (
                <li key={v.id} className={`flex justify-between py-2 font-bold ${v.undone ? "text-muted line-through" : ""}`}>
                  <span>
                    {formatDay(lisbonDate(v.recorded_at), { day: "numeric", month: "short", year: "numeric" })} · {lisbonTime(v.recorded_at)}
                  </span>
                  <span>{v.people} pessoas</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm font-semibold text-muted">Ainda sem atendimentos.</p>
          )}
        </Card>
      </div>
    </>
  );
}
