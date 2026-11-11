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
