import { NextResponse, type NextRequest } from "next/server";
import { isKiosk, unauthorized } from "@/lib/kiosk";
import { findVolunteer } from "@/lib/s2";

// "És tu, Maria Silva?" — one number in, one name out. The kiosk never gets the full list.
export async function POST(request: NextRequest) {
  if (!(await isKiosk())) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as { number?: unknown };
  const number = Number(body.number);
  if (!Number.isInteger(number) || number < 1 || number > 99999) {
    return NextResponse.json({ status: "not_found" });
  }
  const v = await findVolunteer(number);
  if (!v) return NextResponse.json({ status: "not_found" });
  return NextResponse.json({ status: "ok", name: v.name, alreadyAt: v.alreadyAt });
}
