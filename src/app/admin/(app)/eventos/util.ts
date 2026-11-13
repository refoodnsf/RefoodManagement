import { lisbonDate } from "@/lib/domain";
import { formatDay } from "@/lib/period";

export function eventStatus(starts: string, ends: string, today = lisbonDate()) {
  if (today < starts) return { label: "Agendado", tone: "peach" as const };
  if (today > ends) return { label: "Terminado", tone: "grey" as const };
  return { label: "Ativo", tone: "green" as const };
}

export function eventDates(starts: string, ends: string) {
  return starts === ends ? formatDay(starts) : `${formatDay(starts)} – ${formatDay(ends)}`;
}
