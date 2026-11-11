import { TZ, lisbonDate } from "@/lib/domain";

export type PeriodKey = "hoje" | "semana" | "mes" | "30d" | "pers";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mês" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "pers", label: "Personalizado" },
];

/** Offset in minutes of Europe/Lisbon from UTC at a given instant. */
function lisbonOffsetMinutes(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    timeZoneName: "longOffset",
  }).formatToParts(at);
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = name.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** The UTC instant of 00:00 in Lisbon on the given YYYY-MM-DD. */
export function lisbonMidnight(ymd: string): Date {
  const guess = new Date(`${ymd}T00:00:00Z`);
  const offset = lisbonOffsetMinutes(guess);
  return new Date(guess.getTime() - offset * 60_000);
}

export function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isYmd(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export type Range = {
  key: PeriodKey;
  from: string; // inclusive YYYY-MM-DD (Lisbon)
  to: string; // inclusive YYYY-MM-DD (Lisbon)
  start: Date; // UTC instant
  end: Date; // UTC instant (exclusive)
  days: string[];
};

export function resolveRange(p?: string, de?: string, ate?: string, fallback: PeriodKey = "semana"): Range {
  const today = lisbonDate();
  const key = (PERIODS.some((x) => x.key === p) ? p : fallback) as PeriodKey;
  let from = today;
  let to = today;
  if (key === "semana") {
    const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = Sunday
    from = addDays(today, -((dow + 6) % 7));
  } else if (key === "mes") {
    from = `${today.slice(0, 8)}01`;
  } else if (key === "30d") {
    from = addDays(today, -29);
  } else if (key === "pers") {
    from = isYmd(de) ? de : addDays(today, -13);
    to = isYmd(ate) ? ate : today;
    if (from > to) [from, to] = [to, from];
  }
  const days: string[] = [];
  for (let d = from; d <= to && days.length < 370; d = addDays(d, 1)) days.push(d);
  return { key, from, to, start: lisbonMidnight(from), end: lisbonMidnight(addDays(to, 1)), days };
}

export function formatDay(ymd: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("pt-PT", { ...opts, timeZone: "UTC" }).format(new Date(`${ymd}T12:00:00Z`));
}
