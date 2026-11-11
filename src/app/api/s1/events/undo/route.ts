import { NextResponse, type NextRequest } from "next/server";
import { isKiosk } from "@/lib/kiosk";
import { db } from "@/lib/supabase/admin";
import { getCounts } from "@/lib/s1";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Undo from the kiosk's thank-you / check-in screen.
export async function POST(request: NextRequest) {
  if (!(await isKiosk())) return NextResponse.json({ error: "kiosk_not_paired" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { clientId?: string };
  if (!body.clientId || !UUID.test(body.clientId)) {
    return NextResponse.json({ error: "invalid_client_id" }, { status: 400 });
  }

  // Only recent visits can be undone from the kiosk; older ones are corrected in System 3.
  const since = new Date(Date.now() - 6 * 3_600_000).toISOString();
  const { error } = await db()
    .from("beneficiary_events")
    .update({ undone: true, undone_at: new Date().toISOString() })
    .eq("client_id", body.clientId)
    .gte("recorded_at", since);
  if (error) {
    console.error("undo failed", error);
    return NextResponse.json({ error: "undo_failed" }, { status: 500 });
  }
  return NextResponse.json({ status: "ok", counts: await getCounts() });
}
