import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { addDays } from "@/lib/period";
import { lisbonDate } from "@/lib/domain";
import { mediaUrl } from "@/lib/media";
import EventEditor from "./editor";

export const metadata: Metadata = { title: "Evento · Refood" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function EventPage({ params }: PageProps<"/admin/eventos/[id]">) {
  await requireProfile(["administrador"]);
  const { id } = await params;
  if (id === "novo") {
    const today = lisbonDate();
    return <EventEditor initial={{ title: "", body: "", qr_link: "", starts_on: today, ends_on: addDays(today, 13), image: null }} />;
  }
  if (!UUID.test(id)) notFound();
  const { data: e } = await db().from("events").select("*").eq("id", id).maybeSingle();
  if (!e) notFound();
  return (
    <EventEditor
      initial={{ id: e.id, title: e.title, body: e.body ?? "", qr_link: e.qr_link ?? "", starts_on: e.starts_on, ends_on: e.ends_on, image: mediaUrl(e.image_path) }}
    />
  );
}
