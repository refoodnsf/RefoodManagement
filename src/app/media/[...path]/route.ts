import { NextResponse, type NextRequest } from "next/server";
import { isKiosk } from "@/lib/kiosk";
import { getProfile } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { BUCKET } from "@/lib/media";

const SAFE = /^(kiosk|admin|tasks|events)\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

// Images live in a private bucket. Only a paired kiosk or a signed-in coordinator can see them.
// Paths are random and never change, so browsers may cache them for a long time.
export async function GET(_request: NextRequest, ctx: RouteContext<"/media/[...path]">) {
  const { path } = await ctx.params;
  const key = path.join("/");
  if (!SAFE.test(key)) return new NextResponse("Not found", { status: 404 });
  if (!(await isKiosk()) && !(await getProfile())) return new NextResponse("Unauthorized", { status: 401 });

  const { data, error } = await db().storage.from(BUCKET).download(key);
  if (error || !data) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(data, {
    headers: {
      "content-type": data.type || "image/jpeg",
      "cache-control": "private, max-age=604800, immutable",
    },
  });
}
