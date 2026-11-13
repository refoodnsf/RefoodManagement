import "server-only";
import QRCode from "qrcode";
import { db } from "@/lib/supabase/admin";
import { lisbonDate, type Schedule } from "@/lib/domain";
import { mediaUrl } from "@/lib/media";

export type KioskTask = {
  id: string;
  schedule: Schedule;
  name: string;
  details: string;
  photos: string[];
};

export type KioskContact = { id: string; name: string; phone: string; note: string };

export type KioskSlide =
  | { kind: "photo"; id: string; url: string }
  | { kind: "event"; id: string; title: string; body: string; image: string | null; qrSvg: string | null };

export async function getKioskTasks(): Promise<KioskTask[]> {
  const { data, error } = await db()
    .from("tasks")
    .select("id, schedule, name, details, position, task_photos(path, uploaded_at)")
    .is("deleted_at", null)
    .order("schedule")
    .order("position")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id,
    schedule: t.schedule as Schedule,
    name: t.name,
    details: t.details ?? "",
    photos: ((t.task_photos ?? []) as { path: string; uploaded_at: string }[])
      .sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at))
      .map((p) => mediaUrl(p.path)!),
  }));
}

/** Task id → done, for today (Portugal time). */
export async function getTaskStatusToday(): Promise<Record<string, boolean>> {
  const { data, error } = await db().from("task_completions").select("task_id, done").eq("day", lisbonDate());
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.task_id, r.done]));
}

export async function getKioskContacts(): Promise<KioskContact[]> {
  const { data, error } = await db()
    .from("emergency_contacts")
    .select("id, name, phone, note")
    .order("position")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, phone: c.phone, note: c.note ?? "" }));
}

export async function qrSvg(link: string): Promise<string | null> {
  if (!link) return null;
  try {
    return await QRCode.toString(link, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1F2A22", light: "#FFFFFF" } });
  } catch {
    return null;
  }
}

/** Photos and active events for the rotating panel, events placed between photos. */
export async function getKioskSlides(): Promise<KioskSlide[]> {
  const today = lisbonDate();
  const now = new Date().toISOString();
  const [{ data: photos, error: e1 }, { data: events, error: e2 }] = await Promise.all([
    db()
      .from("photos")
      .select("id, path, expires_at")
      .eq("hidden", false)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("uploaded_at", { ascending: false })
      .limit(60),
    db()
      .from("events")
      .select("id, title, body, image_path, qr_link")
      .lte("starts_on", today)
      .gte("ends_on", today)
      .order("starts_on"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const photoSlides: KioskSlide[] = (photos ?? []).map((p) => ({ kind: "photo", id: p.id, url: mediaUrl(p.path)! }));
  const eventSlides: KioskSlide[] = await Promise.all(
    (events ?? []).map(async (e) => ({
      kind: "event" as const,
      id: e.id,
      title: e.title,
      body: e.body ?? "",
      image: mediaUrl(e.image_path),
      qrSvg: await qrSvg(e.qr_link ?? ""),
    })),
  );

  // Spread the events evenly between the photos.
  if (eventSlides.length === 0) return photoSlides;
  if (photoSlides.length === 0) return eventSlides;
  const out: KioskSlide[] = [];
  const step = Math.max(1, Math.round(photoSlides.length / eventSlides.length));
  let ev = 0;
  photoSlides.forEach((p, i) => {
    out.push(p);
    if ((i + 1) % step === 0 && ev < eventSlides.length) out.push(eventSlides[ev++]);
  });
  while (ev < eventSlides.length) out.push(eventSlides[ev++]);
  return out;
}

/** Volunteer by kiosk number (active only), plus today's check-in time if any. */
export async function findVolunteer(number: number) {
  const { data } = await db().from("volunteers").select("id, name, active").eq("number", number).maybeSingle();
  if (!data || !data.active) return null;
  const { data: ci } = await db()
    .from("check_ins")
    .select("checked_in_at")
    .eq("volunteer_id", data.id)
    .eq("day", lisbonDate())
    .maybeSingle();
  return { id: data.id as string, name: data.name as string, alreadyAt: (ci?.checked_in_at as string | undefined) ?? null };
}
