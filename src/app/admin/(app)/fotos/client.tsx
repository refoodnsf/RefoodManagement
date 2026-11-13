"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { shrinkImage } from "@/lib/image-client";
import { Chip, PlusIcon } from "../../ui";
import { deletePhoto, setPhotoHidden, uploadPhotos } from "./actions";

export function UploadPhotos() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string>();
  return (
    <span className="flex items-center gap-2">
      {msg && <span className="text-[13px] font-bold text-muted">{msg}</span>}
      <label className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-leaf px-4 text-sm font-extrabold text-white hover:bg-leaf-dark ${pending ? "opacity-60" : ""}`}>
        <PlusIcon />
        {pending ? "A carregar…" : "Carregar fotos"}
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={pending}
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (!files.length) return;
            start(async () => {
              setMsg(undefined);
              // One request per few photos keeps each upload small.
              let added = 0;
              for (let i = 0; i < files.length; i += 4) {
                const data = new FormData();
                for (const f of files.slice(i, i + 4)) data.append("photos", await shrinkImage(f));
                const r = await uploadPhotos(data);
                added += r.count ?? 0;
                if (r.error) {
                  setMsg(r.error);
                  break;
                }
              }
              if (added) setMsg(`${added} ${added === 1 ? "foto adicionada" : "fotos adicionadas"}`);
              router.refresh();
            });
          }}
        />
      </label>
    </span>
  );
}

export function PhotoCard({
  id,
  url,
  hidden,
  origin,
  date,
  retention,
}: {
  id: string;
  url: string;
  hidden: boolean;
  origin: string;
  date: string;
  retention: { label: string; tone: "green" | "peach" | "red" };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  return (
    <article className={`flex flex-col overflow-hidden rounded-2xl border border-line bg-white ${pending ? "opacity-60" : ""}`}>
      <div className="relative h-[150px] bg-[#dce9df]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" loading="lazy" className={`h-full w-full object-cover ${hidden ? "opacity-45" : ""}`} />
        <span className="absolute bottom-2.5 right-2.5">
          <Chip tone={retention.tone}>{retention.label}</Chip>
        </span>
        {hidden && (
          <span className="absolute left-2.5 top-2.5">
            <Chip tone="grey">Oculta</Chip>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-[13px] font-extrabold">{origin}</span>
          <span className="text-xs font-bold text-muted">{date}</span>
        </span>
        {asking ? (
          <span className="flex gap-1">
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  await deletePhoto(id);
                  router.refresh();
                })
              }
              className="h-7 rounded-md bg-danger px-2 text-xs font-extrabold text-white"
            >
              Apagar
            </button>
            <button type="button" onClick={() => setAsking(false)} className="h-7 rounded-md border border-line-strong px-2 text-xs font-extrabold">
              Não
            </button>
          </span>
        ) : (
          <>
            <button type="button" onClick={() => setAsking(true)} aria-label="Apagar foto" title="Apagar foto" className="rounded-md p-1 text-danger hover:bg-alert-soft">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
              </svg>
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={!hidden}
              aria-label="Mostrar no quiosque"
              title="Mostrar no quiosque"
              onClick={() =>
                start(async () => {
                  await setPhotoHidden(id, !hidden);
                  router.refresh();
                })
              }
              className={`flex h-7 w-[46px] rounded-[14px] p-[3px] ${hidden ? "justify-start bg-line-strong" : "justify-end bg-leaf"}`}
            >
              <span className="block h-[22px] w-[22px] rounded-full bg-white" />
            </button>
          </>
        )}
      </div>
    </article>
  );
}
