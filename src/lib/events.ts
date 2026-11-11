import "server-only";
import { db } from "@/lib/supabase/admin";

export type EventRow = {
  id: string;
  recorded_at: string;
  type: "nao_inscrito" | "inscrito";
  people: number;
  kiosk_id: string;
  undone: boolean;
  beneficiary_id: string | null;
  beneficiaries: { number: number; name: string } | null;
};

/** All beneficiary events between two instants (paged past Supabase's 1000-row limit). */
export async function fetchEvents(opts: {
  start: Date;
  end: Date;
  type?: "nao_inscrito" | "inscrito";
  includeUndone?: boolean;
  limit?: number;
}): Promise<EventRow[]> {
  const pageSize = 1000;
  const max = opts.limit ?? 50_000;
  const out: EventRow[] = [];
  for (let from = 0; from < max; from += pageSize) {
    let query = db()
      .from("beneficiary_events")
      .select("id, recorded_at, type, people, kiosk_id, undone, beneficiary_id, beneficiaries(number, name)")
      .gte("recorded_at", opts.start.toISOString())
      .lt("recorded_at", opts.end.toISOString())
      .order("recorded_at", { ascending: false })
      .range(from, Math.min(from + pageSize, max) - 1);
    if (opts.type) query = query.eq("type", opts.type);
    if (!opts.includeUndone) query = query.eq("undone", false);
    const { data, error } = await query;
    if (error) throw error;
    out.push(...((data ?? []) as unknown as EventRow[]));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM so Excel opens accents correctly; semicolons for Portuguese Excel.
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
}
