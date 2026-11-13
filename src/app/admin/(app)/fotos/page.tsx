import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { lisbonDate, lisbonTime } from "@/lib/domain";
import { mediaUrl } from "@/lib/media";
import { addDays, formatDay } from "@/lib/period";
import { PageHeader } from "../../ui";
import { PhotoCard, UploadPhotos } from "./client";

export const metadata: Metadata = { title: "Fotos · Refood" };

function when(iso: string) {
  const day = lisbonDate(iso);
  const today = lisbonDate();
  if (day === today) return `Hoje, ${lisbonTime(iso)}`;
  if (day === addDays(today, -1)) return `Ontem, ${lisbonTime(iso)}`;
  return formatDay(day, { weekday: "short", day: "numeric", month: "short" });
}

function retention(expires: string | null) {
  if (!expires) return { label: "Permanente", tone: "green" as const };
  const days = Math.max(0, Math.ceil((Date.parse(expires) - Date.now()) / 86_400_000));
  if (days <= 1) return { label: "Apaga-se amanhã", tone: "red" as const };
  return { label: `Apaga-se em ${days} dias`, tone: "peach" as const };
}

export default async function PhotosPage({ searchParams }: PageProps<"/admin/fotos">) {
  await requireProfile(["administrador"]);
  const sp = await searchParams;
  const origem = sp.origem === "tablet" || sp.origem === "gestao" ? sp.origem : "todas";
  let query = db()
    .from("photos")
    .select("id, path, uploaded_at, source, expires_at, hidden")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("uploaded_at", { ascending: false })
    .limit(300);
  if (origem !== "todas") query = query.eq("source", origem === "tablet" ? "kiosk" : "admin");
  const { data } = await query;
  const photos = data ?? [];
  const hidden = photos.filter((p) => p.hidden).length;

  return (
    <>
      <PageHeader title="Fotos" subtitle={`${photos.length - hidden} visíveis no quiosque · ${hidden} ocultas`}>
        <div role="group" aria-label="Origem" className="flex gap-1 rounded-xl border border-line bg-white p-1">
          {[
            ["todas", "Todas"],
            ["tablet", "Tablet"],
            ["gestao", "Gestão"],
          ].map(([v, l]) => (
            <Link
              key={v}
              href={v === "todas" ? "/admin/fotos" : `/admin/fotos?origem=${v}`}
              aria-current={origem === v ? "page" : undefined}
              className={`flex h-8 items-center rounded-lg px-3 text-[13px] font-extrabold ${origem === v ? "bg-ink text-white" : "text-quiet hover:bg-ground"}`}
            >
              {l}
            </Link>
          ))}
        </div>
        <UploadPhotos />
      </PageHeader>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
        <div className="rounded-2xl border border-peach-line bg-peach px-4 py-3 text-sm text-clay">
          <b className="block font-black">Fotos do tablet: 5 dias</b>
          <span className="font-semibold">Tiradas no quiosque; apagam-se sozinhas 5 dias depois de tiradas.</span>
        </div>
        <div className="rounded-2xl border border-leaf-line bg-leaf-soft px-4 py-3 text-sm text-leaf-deep">
          <b className="block font-black">Fotos da gestão: permanentes</b>
          <span className="font-semibold">Carregadas aqui; ficam guardadas até alguém as apagar.</span>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
        {photos.map((p) => (
          <PhotoCard
            key={p.id}
            id={p.id}
            url={mediaUrl(p.path)!}
            hidden={p.hidden}
            origin={p.source === "kiosk" ? "Tablet do quiosque" : "Gestão"}
            date={when(p.uploaded_at)}
            retention={retention(p.expires_at)}
          />
        ))}
      </div>
      {photos.length === 0 && <p className="rounded-2xl border border-line bg-white px-4 py-10 text-center text-sm font-bold text-muted">Ainda não há fotos.</p>}
    </>
  );
}
