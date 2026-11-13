import { NextResponse } from "next/server";
import { isKiosk, unauthorized } from "@/lib/kiosk";
import { getKioskContacts, getKioskSlides, getKioskTasks, getTaskStatusToday } from "@/lib/s2";
import { lisbonDate } from "@/lib/domain";

export const dynamic = "force-dynamic";

// Everything the volunteer kiosk shows. It never includes the volunteer list.
export async function GET() {
  if (!(await isKiosk())) return unauthorized();
  const [tasks, status, contacts, slides] = await Promise.all([
    getKioskTasks(),
    getTaskStatusToday(),
    getKioskContacts(),
    getKioskSlides(),
  ]);
  return NextResponse.json(
    { day: lisbonDate(), tasks, status, contacts, slides, serverTime: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
