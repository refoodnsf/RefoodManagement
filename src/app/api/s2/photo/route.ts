import { NextResponse, type NextRequest } from "next/server";
import { UUID_RE, isKiosk, unauthorized } from "@/lib/kiosk";
import { db } from "@/lib/supabase/admin";
import { uploadImage } from "@/lib/media";
import { KIOSK_PHOTO_DAYS } from "@/lib/domain";

// A photo taken with the Surface camera. It joins the rotation and is deleted after 5 days.
export async function POST(request: NextRequest) {
  if (!(await isKiosk())) return unauthorized();
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const clientId = String(form?.get("clientId") ?? "");
  if (!(file instanceof Blob) || file.size === 0) return NextResponse.json({ error: "no_file" }, { status: 400 });
  if (!UUID_RE.test(clientId)) return NextResponse.json({ error: "invalid_client_id" }, { status: 400 });

  const supabase = db();
  const { data: same } = await supabase.from("photos").select("id").eq("client_id", clientId).maybeSingle();
  if (same) return NextResponse.json({ status: "ok", id: same.id });

  let path: string;
  try {
    path = await uploadImage(file, "kiosk");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const now = Date.now();
  const { data, error } = await supabase
    .from("photos")
    .insert({
      client_id: clientId,
      path,
      source: "kiosk",
      uploaded_at: new Date(now).toISOString(),
      expires_at: new Date(now + KIOSK_PHOTO_DAYS * 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    console.error("insert photo failed", error);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({ status: "ok", id: data.id });
}
