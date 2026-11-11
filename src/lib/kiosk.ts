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
