import { NextResponse, type NextRequest } from "next/server";
import { isKiosk } from "@/lib/kiosk";
import { db } from "@/lib/supabase/admin";
import { getCounts } from "@/lib/s1";
import { lisbonDate } from "@/lib/domain";
import { addDays, lisbonMidnight } from "@/lib/period";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Body = {
  clientId?: string;
  type?: string;
  beneficiaryId?: string;
  recordedAt?: string;
  kioskId?: string;
};

/** Accept a client time (offline replay) only if it is within the last 3 days and not in the future. */
function pickTime(raw: string | undefined) {
  const now = Date.now();
  const t = raw ? Date.parse(raw) : NaN;
  if (Number.isNaN(t) || t > now + 60_000 || t < now - 3 * 86_400_000) return new Date(now);
  return new Date(t);
}

export async function POST(request: NextRequest) {
  if (!(await isKiosk())) return NextResponse.json({ error: "kiosk_not_paired" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.clientId || !UUID.test(body.clientId)) {
    return NextResponse.json({ error: "invalid_client_id" }, { status: 400 });
  }
  if (body.type !== "nao_inscrito" && body.type !== "inscrito") {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }

  const supabase = db();

  // Idempotent: the same clientId is only ever recorded once.
  const { data: existing } = await supabase
    .from("beneficiary_events")
    .select("id, people, undone")
    .eq("client_id", body.clientId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ status: "ok", id: existing.id, people: existing.people, counts: await getCounts() });
  }

  const recordedAt = pickTime(body.recordedAt);
  const kioskId = (body.kioskId ?? "s1").slice(0, 40);
  let people = 1;
  let beneficiaryId: string | null = null;

  if (body.type === "inscrito") {
    if (!body.beneficiaryId || !UUID.test(body.beneficiaryId)) {
      return NextResponse.json({ error: "invalid_beneficiary" }, { status: 400 });
    }
    const { data: b } = await supabase
      .from("beneficiaries")
      .select("id, adults, children, active")
      .eq("id", body.beneficiaryId)
      .maybeSingle();
    if (!b || !b.active) return NextResponse.json({ error: "beneficiary_not_found" }, { status: 404 });

    const day = lisbonDate(recordedAt);
    const { data: earlier } = await supabase
      .from("beneficiary_events")
      .select("recorded_at")
      .eq("beneficiary_id", b.id)
      .eq("undone", false)
      .gte("recorded_at", lisbonMidnight(day).toISOString())
      .lt("recorded_at", lisbonMidnight(addDays(day, 1)).toISOString())
      .order("recorded_at")
      .limit(1);
    if (earlier && earlier.length > 0) {
      return NextResponse.json({ status: "already", at: earlier[0].recorded_at, counts: await getCounts() });
    }
    people = Math.max(1, b.adults + b.children);
    beneficiaryId = b.id;
  }

  const { data: inserted, error } = await supabase
    .from("beneficiary_events")
    .insert({
      client_id: body.clientId,
      type: body.type,
      beneficiary_id: beneficiaryId,
      people,
      recorded_at: recordedAt.toISOString(),
      kiosk_id: kioskId,
    })
    .select("id")
    .single();

  if (error) {
    // A concurrent retry with the same clientId already landed.
    if (error.code === "23505") {
      return NextResponse.json({ status: "ok", people, counts: await getCounts() });
    }
    console.error("insert beneficiary_event failed", error);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", id: inserted.id, people, counts: await getCounts() });
}
