import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/supabase/admin";
import { deleteImages } from "@/lib/media";

// Daily Vercel cron: deletes kiosk photos 5 days after they were taken.
// (The kiosk already stops showing them at expires_at; this frees the storage.)
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { data, error } = await db()
    .from("photos")
    .select("id, path")
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString())
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = data ?? [];
  await deleteImages(rows.map((r) => r.path));
  if (rows.length) await db().from("photos").delete().in("id", rows.map((r) => r.id));
  return NextResponse.json({ deleted: rows.length });
}
