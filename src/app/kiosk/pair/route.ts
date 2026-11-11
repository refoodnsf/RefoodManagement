import { NextResponse, type NextRequest } from "next/server";
import { KIOSK_COOKIE, tokenMatches } from "@/lib/kiosk";

// Pair a Surface as a kiosk: open /kiosk/pair?token=<KIOSK_TOKEN> once on it.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const next = request.nextUrl.searchParams.get("next") === "s2" ? "/s2" : "/s1";

  if (!tokenMatches(token)) {
    return new NextResponse("Código de quiosque inválido / Invalid kiosk code", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(KIOSK_COOKIE, token!, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  return response;
}
