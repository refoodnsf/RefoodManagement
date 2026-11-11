import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireProfile } from "@/lib/auth";
import { Card, PageHeader } from "../../ui";
import Reveal from "./reveal";

export const metadata: Metadata = { title: "Quiosques · Refood" };

export default async function KiosksPage() {
  await requireProfile(["administrador"]);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const token = process.env.KIOSK_TOKEN;
  const link = token ? `${proto}://${host}/kiosk/pair?token=${encodeURIComponent(token)}` : null;

  return (
    <>
      <PageHeader title="Quiosques" subtitle="Autorize cada Surface uma vez; fica autorizada durante mais de um ano." />
      <Card className="flex max-w-[760px] flex-col gap-4 p-6">
        <h2 className="text-[19px] font-black">Quiosque de beneficiários (Sistema 1)</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm font-semibold text-quiet">
          <li>Na Surface, abra o Microsoft Edge.</li>
          <li>Abra o link de emparelhamento abaixo. O ecrã do quiosque aparece de seguida.</li>
          <li>Configure o Edge em modo quiosque com o endereço <code className="rounded bg-sand px-1">/s1</code> como página inicial.</li>
        </ol>
        {link ? (
          <Reveal link={link} />
        ) : (
          <p className="rounded-[10px] bg-alert-soft px-3 py-2 text-sm font-bold text-danger">KIOSK_TOKEN não está configurado no servidor.</p>
        )}
        <p className="text-xs font-bold text-muted">
          Trate este link como uma palavra-passe: quem o tiver consegue ver a lista de beneficiários no quiosque. Para o revogar,
          mude o KIOSK_TOKEN no Vercel e volte a emparelhar as Surfaces.
        </p>
      </Card>
    </>
  );
}
