import { NextResponse } from "next/server";
import { isKiosk } from "@/lib/kiosk";
import { getCounts, getKioskBeneficiaries, getServedToday } from "@/lib/s1";

export const dynamic = "force-dynamic";

// Everything the kiosk needs: counts, the beneficiary list and who was served today.
export async function GET() {
  if (!(await isKiosk())) return NextResponse.json({ error: "kiosk_not_paired" }, { status: 401 });
  const [counts, beneficiaries, servedToday] = await Promise.all([
    getCounts(),
    getKioskBeneficiaries(),
    getServedToday(),
  ]);
  return NextResponse.json(
    { counts, beneficiaries, servedToday, serverTime: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
