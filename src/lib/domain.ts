// Shared constants and helpers (safe for both server and client).

export const TZ = "Europe/Lisbon";

export const FOOD_OPTIONS = [
  "Sem glúten",
  "Sem lactose",
  "Alergia a frutos secos",
  "Vegetariano",
  "Sem carne de porco",
  "Diabetes",
  "Sem sal",
  "Halal",
] as const;

export type BeneficiaryType = "familia" | "individual";
export type EventType = "nao_inscrito" | "inscrito";

export const BENEFICIARY_TYPE_LABEL: Record<BeneficiaryType, string> = {
  familia: "Família",
  individual: "Individual",
};

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  nao_inscrito: "Não inscrito",
  inscrito: "Inscrito",
};

export function padNumber(n: number) {
  return String(n).padStart(4, "0");
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** Lower-case, accent-free text for searching. */
export function fold(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** YYYY-MM-DD of an instant in Portugal time. */
export function lisbonDate(d: Date | string | number = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(d));
}

/** HH:MM of an instant in Portugal time. */
export function lisbonTime(d: Date | string | number) {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

export type Schedule = 1 | 2;

export const SCHEDULE_LABEL: Record<Schedule, { pt: string; en: string }> = {
  1: { pt: "1.º Turno", en: "1st Schedule" },
  2: { pt: "2.º Turno", en: "2nd Schedule" },
};

/** Hour that starts the 2nd Schedule (Portugal time). */
export const SECOND_SCHEDULE_HOUR = 20;

/** Hour (0–23) of an instant in Portugal time. */
export function lisbonHour(d: Date | string | number = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(new Date(d)),
  );
}

/** 1st Schedule before 20:00, 2nd Schedule from 20:00 until midnight. */
export function autoSchedule(d: Date | string | number = new Date()): Schedule {
  return lisbonHour(d) < SECOND_SCHEDULE_HOUR ? 1 : 2;
}

/** First word of a name, for "Bem-vindo/a, Maria!". */
export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

/** Photos taken on the kiosk are deleted this many days after they were taken. */
export const KIOSK_PHOTO_DAYS = 5;
