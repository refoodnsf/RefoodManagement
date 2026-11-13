import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { lisbonDate } from "@/lib/domain";
import { mediaUrl } from "@/lib/media";
import { eventDates, eventStatus } from "./util";
import { Chip, OkNote, PageHeader, PlusIcon, primaryLink } from "../../ui";

export const metadata: Metadata = { title: "Eventos · Refood" };

export default async function EventsPage({ searchParams }: PageProps<"/admin/eventos">) {
  await requireProfile(["administrador"]);
  const sp = await searchParams;
  const { data } = await db().from("events").select("id, title, image_path, qr_link, starts_on, ends_on").order("starts_on", { ascending: false });
  const today = lisbonDate();
  const rank = (s: string) => ({ Ativo: 0, Agendado: 1, Terminado: 2 })[s] ?? 3;
  const events = (data ?? [])
    .map((e) => ({ ...e, status: eventStatus(e.starts_on, e.ends_on, today) }))
    .sort((a, b) => rank(a.status.label) - rank(b.status.label));

  return (
    <>
      <PageHeader title="Eventos" subtitle="Os eventos ativos aparecem no painel de fotos do quiosque de voluntários, entre as fotos.">
        <Link href="/admin/eventos/novo" className={primaryLink}>
          <PlusIcon />
          Novo evento
        </Link>
      </PageHeader>
      {sp.guardado && <OkNote>Evento guardado.</OkNote>}
      {sp.apagado && <OkNote>Evento apagado.</OkNote>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        {events.map((e) => (
          <article key={e.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
            <div className="h-[150px] bg-[#dce9df]">
              {e.image_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(e.image_path)!} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center bg-peach text-sm font-extrabold text-clay">Sem imagem</div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
                <Chip tone={e.status.tone}>{e.status.label}</Chip>
                {e.qr_link && <span>· com QR</span>}
              </div>
              <h2 className="text-[17px] font-black">{e.title}</h2>
              <span className="text-[13px] font-bold text-muted">{eventDates(e.starts_on, e.ends_on)}</span>
              <div className="mt-auto pt-2">
                <Link href={`/admin/eventos/${e.id}`} className="inline-flex h-[34px] items-center rounded-lg border border-line-strong px-3 text-[13px] font-extrabold hover:bg-ground">
                  Editar
                </Link>
              </div>
            </div>
          </article>
        ))}
        {events.length === 0 && <p className="rounded-2xl border border-line bg-white px-4 py-10 text-center text-sm font-bold text-muted">Ainda não há eventos.</p>}
      </div>
    </>
  );
}
