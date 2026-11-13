import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const KIOSK_COOKIE = "refood_kiosk";

export function tokenMatches(candidate: string | undefined | null): boolean {
  const expected = process.env.KIOSK_TOKEN;
  if (!expected || !candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** True when this browser has been paired as a kiosk. */
export async function isKiosk(): Promise<boolean> {
  const store = await cookies();
  return tokenMatches(store.get(KIOSK_COOKIE)?.value);
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accept a client time (offline replay) only if it is within the last 3 days and not in the future. */
export function pickTime(raw: unknown): Date {
  const now = Date.now();
  const t = typeof raw === "string" ? Date.parse(raw) : NaN;
  if (Number.isNaN(t) || t > now + 60_000 || t < now - 3 * 86_400_000) return new Date(now);
  return new Date(t);
}

export function unauthorized() {
  return Response.json({ error: "kiosk_not_paired" }, { status: 401 });
}
