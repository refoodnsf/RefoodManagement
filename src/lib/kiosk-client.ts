// Browser-only helpers shared by both kiosks (offline snapshot + write queue).

export const POLL_MS = 10_000;
export const REQUEST_TIMEOUT_MS = 5_000;

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the kiosk still works for this session.
  }
}

/** fetch with a timeout, so a slow network falls back to the offline queue. */
export async function request(url: string, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { cache: "no-store", ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function post(url: string, body: unknown) {
  return request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

export function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback for non-secure contexts.
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16),
  );
}
