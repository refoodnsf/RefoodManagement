import { NextResponse, type NextRequest } from "next/server";
import { UUID_RE, isKiosk, pickTime, unauthorized } from "@/lib/kiosk";
import { db } from "@/lib/supabase/admin";
import { lisbonDate } from "@/lib/domain";

type Body = { clientId?: string; number?: unknown; schedule?: unknown; recordedAt?: string };

export async function POST(request: NextRequest) {
  if (!(await isKiosk())) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.clientId || !UUID_RE.test(body.clientId)) return NextResponse.json({ error: "invalid_client_id" }, { status: 400 });
  const number = Number(body.number);
  const schedule = Number(body.schedule) === 2 ? 2 : 1;
  if (!Number.isInteger(number) || number < 1) return NextResponse.json({ status: "not_found" });

  const supabase = db();

  // Idempotent retry.
  const { data: same } = await supabase.from("check_ins").select("id").eq("client_id", body.clientId).maybeSingle();
  if (same) return NextResponse.json({ status: "ok" });

  const { data: v } = await supabase.from("volunteers").select("id, name, active").eq("number", number).maybeSingle();
  if (!v || !v.active) return NextResponse.json({ status: "not_found" });

  const at = pickTime(body.recordedAt);
  const day = lisbonDate(at);
  const { error } = await supabase.from("check_ins").insert({
    client_id: body.clientId,
    volunteer_id: v.id,
    checked_in_at: at.toISOString(),
    day,
    schedule,
  });
  if (error) {
    if (error.code === "23505") {
      // Already checked in today (or the same retry landed twice).
      const { data: earlier } = await supabase.from("check_ins").select("checked_in_at, client_id").eq("volunteer_id", v.id).eq("day", day).maybeSingle();
      if (earlier?.client_id === body.clientId) return NextResponse.json({ status: "ok", name: v.name });
      return NextResponse.json({ status: "already", at: earlier?.checked_in_at ?? null, name: v.name });
    }
    console.error("insert check_in failed", error);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({ status: "ok", name: v.name });
}
