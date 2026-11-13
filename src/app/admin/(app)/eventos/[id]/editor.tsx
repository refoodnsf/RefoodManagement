"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";
import { shrinkImage } from "@/lib/image-client";
import EventCard from "@/app/s2/event-card";
import { ErrorNote, Field, PrimaryButton, SecondaryButton } from "../../../ui";
import { deleteEvent, saveEvent } from "../actions";
import { eventDates, eventStatus } from "../util";

type Initial = { id?: string; title: string; body: string; qr_link: string; starts_on: string; ends_on: string; image: string | null };

const SCALE = 0.6;

export default function EventEditor({ initial }: { initial: Initial }) {
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [link, setLink] = useState(initial.qr_link);
  const [starts, setStarts] = useState(initial.starts_on);
  const [ends, setEnds] = useState(initial.ends_on);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initial.image);
  const [removeImage, setRemoveImage] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    const valid = /^https?:\/\/\S+$/i.test(link);
    const job = valid ? QRCode.toString(link, { type: "svg", margin: 0, color: { dark: "#1F2A22", light: "#FFFFFF" } }) : Promise.resolve(null);
    void job.then((svg) => live && setQrSvg(svg)).catch(() => live && setQrSvg(null));
    return () => {
      live = false;
    };
  }, [link]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const t = setTimeout(() => setPreview(url), 0);
    return () => {
      clearTimeout(t);
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const status = starts && ends ? eventStatus(starts, ends) : null;

  const submit = () =>
    start(async () => {
      setError(undefined);
      const data = new FormData();
      if (initial.id) data.set("id", initial.id);
      data.set("title", title);
      data.set("body", body);
      data.set("qr_link", link);
      data.set("starts_on", starts);
      data.set("ends_on", ends);
      if (file) data.set("image", await shrinkImage(file));
      if (removeImage) data.set("removeImage", "1");
      const r = await saveEvent(data);
      if (r?.error) setError(r.error);
    });

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-[28px] font-black">{initial.id ? "Editar evento" : "Novo evento"}</h1>
        <Link href="/admin/eventos" className="inline-flex h-10 items-center rounded-[10px] border border-line-strong bg-white px-4 text-sm font-extrabold hover:bg-ground">
          Cancelar
        </Link>
        <PrimaryButton type="button" disabled={pending} onClick={submit}>
          {pending ? "A guardar…" : "Guardar"}
        </PrimaryButton>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex flex-wrap items-start gap-6">
        <form
          className="flex min-w-0 flex-[1_1_420px] flex-col gap-4 rounded-[20px] border border-line bg-white p-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field label="Título">
            <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} className="input" />
          </Field>
          <label className="flex flex-col gap-1.5 text-sm font-extrabold">
            Texto
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={400} className="input" />
            <span className={`text-xs font-bold ${body.length > 140 ? "text-clay" : "text-muted"}`}>
              {body.length} / 140 caracteres — textos curtos leem-se melhor no quiosque.
            </span>
          </label>
          <div className="flex flex-col gap-1.5 text-sm font-extrabold">
            Imagem
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-line-strong bg-ground p-4 font-extrabold text-leaf-link">
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setRemoveImage(false);
                }}
              />
              {file ? file.name : preview ? "Trocar imagem" : "Escolher uma imagem"}
            </label>
            {preview && !removeImage && (
              <button
                type="button"
                className="self-start text-xs font-extrabold text-danger hover:underline"
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                  setRemoveImage(true);
                }}
              >
                Remover imagem
              </button>
            )}
          </div>
          <Field label="Link para o código QR" hint="(opcional)">
            <input value={link} onChange={(e) => setLink(e.target.value.trim())} type="url" placeholder="https://" maxLength={500} className="input" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Início">
              <input type="date" value={starts} onChange={(e) => setStarts(e.target.value)} required className="input" />
            </Field>
            <Field label="Fim">
              <input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} required className="input" />
            </Field>
          </div>
          {initial.id && (
            <div className="border-t border-line-soft pt-3">
              {confirmDelete ? (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => start(async () => void (await deleteEvent(initial.id!)))}
                    className="h-[34px] rounded-lg bg-danger px-3 text-[13px] font-extrabold text-white"
                  >
                    Confirmar apagar
                  </button>
                  <SecondaryButton type="button" className="!h-[34px]" onClick={() => setConfirmDelete(false)}>
                    Cancelar
                  </SecondaryButton>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm font-extrabold text-danger hover:underline">
                  Apagar evento
                </button>
              )}
            </div>
          )}
        </form>
        <aside className="flex flex-col gap-2">
          <span className="text-xs font-extrabold text-muted">Pré-visualização no quiosque (60%)</span>
          <div className="overflow-hidden rounded-[22px]" style={{ width: 804 * SCALE, height: 480 * SCALE }}>
            <div style={{ width: 804, height: 480, transform: `scale(${SCALE})`, transformOrigin: "top left" }} className="font-sans text-ink">
              <EventCard slide={{ title: title || "Título do evento", body, image: removeImage ? null : preview, qrSvg }} />
            </div>
          </div>
          {status && (
            <span className="text-[13px] font-bold text-muted">
              {status.label} · aparece de {eventDates(starts, ends)}
            </span>
          )}
        </aside>
      </div>
    </>
  );
}
