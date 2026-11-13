import "server-only";
import { db } from "@/lib/supabase/admin";
import { fetchCheckIns, type CheckInRow } from "@/lib/events";
import { lisbonDate } from "@/lib/domain";
import type { Range } from "@/lib/period";

export type ScheduleDay = { day: string; open: boolean; done: number; total: number };

export type TaskAnalytics = {
  checkIns: CheckInRow[];
  activeVolunteers: { id: string; number: number; name: string }[];
  absent30: { number: number; name: string; last: string | null }[];
  bySchedule: Record<1 | 2, { done: number; total: number; openDays: number; days: ScheduleDay[] }>;
  mostUndone: { name: string; schedule: number; days: number }[];
};

/**
 * Volunteer and task figures for the dashboard. A day counts as "open" for a
 * schedule when anyone checked in or ticked a task in it; closed days are left
 * out of the completion rate.
 */
export async function taskAnalytics(range: Range, since30Start: Date): Promise<TaskAnalytics> {
  const [checkIns, { data: vols }, { data: tasks }, { data: comps }, { data: recent }] = await Promise.all([
    fetchCheckIns({ start: range.start, end: range.end }),
    db().from("volunteers").select("id, number, name, active"),
    db().from("tasks").select("id, schedule, name, created_at, deleted_at"),
    db().from("task_completions").select("task_id, day, schedule, done").gte("day", range.from).lte("day", range.to).limit(50000),
    db().from("check_ins").select("volunteer_id, checked_in_at").order("checked_in_at", { ascending: false }).limit(20000),
  ]);

  const active = (vols ?? []).filter((v) => v.active);
  const lastBy = new Map<string, string>();
  for (const c of recent ?? []) if (!lastBy.has(c.volunteer_id)) lastBy.set(c.volunteer_id, c.checked_in_at);
  const absent30 = active
    .filter((v) => {
      const last = lastBy.get(v.id);
      return !last || Date.parse(last) < since30Start.getTime();
    })
    .map((v) => ({ number: v.number, name: v.name, last: lastBy.get(v.id) ?? null }))
    .sort((a, b) => (a.last ?? "").localeCompare(b.last ?? ""));

  const doneSet = new Set((comps ?? []).filter((c) => c.done).map((c) => `${c.task_id}|${c.day}`));
  const openDays = { 1: new Set<string>(), 2: new Set<string>() } as Record<1 | 2, Set<string>>;
  for (const c of checkIns) openDays[c.schedule].add(lisbonDate(c.checked_in_at));
  for (const c of comps ?? []) openDays[c.schedule as 1 | 2]?.add(c.day);

  const existed = (t: { created_at: string; deleted_at: string | null }, day: string) =>
    lisbonDate(t.created_at) <= day && (!t.deleted_at || lisbonDate(t.deleted_at) > day);

  const undone = new Map<string, number>();
  const bySchedule = {} as TaskAnalytics["bySchedule"];
  for (const s of [1, 2] as const) {
    const list = (tasks ?? []).filter((t) => t.schedule === s);
    let done = 0;
    let total = 0;
    const days: ScheduleDay[] = range.days.map((day) => {
      const open = openDays[s].has(day);
      const here = list.filter((t) => existed(t, day));
      const d = here.filter((t) => doneSet.has(`${t.id}|${day}`)).length;
      if (open) {
        done += d;
        total += here.length;
        for (const t of here) if (!doneSet.has(`${t.id}|${day}`)) undone.set(t.id, (undone.get(t.id) ?? 0) + 1);
      }
      return { day, open, done: d, total: here.length };
    });
    bySchedule[s] = { done, total, openDays: openDays[s].size, days };
  }

  const nameOf = new Map((tasks ?? []).map((t) => [t.id, t]));
  const mostUndone = [...undone.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, days]) => ({ name: nameOf.get(id)?.name ?? "—", schedule: nameOf.get(id)?.schedule ?? 1, days }));

  return {
    checkIns,
    activeVolunteers: active.map((v) => ({ id: v.id, number: v.number, name: v.name })),
    absent30,
    bySchedule,
    mostUndone,
  };
}
