import "server-only";
import { db } from "@/lib/supabase/admin";
import { lisbonDate } from "@/lib/domain";
import { addDays, lisbonMidnight } from "@/lib/period";

export type KioskBeneficiary = {
  id: string;
  number: number;
  name: string;
  type: "familia" | "individual";
  adults: number;
  children: number;
  foodNeeds: string[];
  foodNotes: string;
};

export async function getCounts(): Promise<{ today: number; week: number }> {
  const { data, error } = await db().rpc("s1_counts");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { today: row?.today ?? 0, week: row?.week ?? 0 };
}

export async function getKioskBeneficiaries(): Promise<KioskBeneficiary[]> {
  const { data, error } = await db()
    .from("beneficiaries")
    .select("id, number, name, type, adults, children, food_needs, food_notes")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((b) => ({
    id: b.id,
    number: b.number,
    name: b.name,
    type: b.type,
    adults: b.adults,
    children: b.children,
    foodNeeds: b.food_needs ?? [],
    foodNotes: b.food_notes ?? "",
  }));
}

/** Beneficiary id → ISO time of their (first) visit today, Portugal time. */
export async function getServedToday(): Promise<Record<string, string>> {
  const today = lisbonDate();
  const { data, error } = await db()
    .from("beneficiary_events")
    .select("beneficiary_id, recorded_at")
    .eq("type", "inscrito")
    .eq("undone", false)
    .gte("recorded_at", lisbonMidnight(today).toISOString())
    .lt("recorded_at", lisbonMidnight(addDays(today, 1)).toISOString())
    .order("recorded_at");
  if (error) throw error;
  const served: Record<string, string> = {};
  for (const e of data ?? []) {
    if (e.beneficiary_id && !served[e.beneficiary_id]) served[e.beneficiary_id] = e.recorded_at;
  }
  return served;
}
