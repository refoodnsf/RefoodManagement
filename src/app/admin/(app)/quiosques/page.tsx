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
      {[
        { n: 1, title: "Quiosque de beneficiários (Sistema 1)", path: "/s1", next: "s1", camera: false },
        { n: 2, title: "Quiosque de voluntários (Sistema 2)", path: "/s2", next: "s2", camera: true },
      ].map((k) => (
        <Card key={k.n} className="flex max-w-[760px] flex-col gap-4 p-6">
          <h2 className="text-[19px] font-black">
            Surface {k.n} · {k.title}
          </h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm font-semibold text-quiet">
            <li>Na Surface, abra o Microsoft Edge.</li>
            <li>Abra o link de emparelhamento abaixo. O ecrã do quiosque aparece de seguida.</li>
            {k.camera && <li>Quando o Edge perguntar, permita o acesso à câmara (para “Carregar fotos”).</li>}
            <li>
              Configure o Edge em modo quiosque com o endereço <code className="rounded bg-sand px-1">{k.path}</code> como página inicial.
            </li>
          </ol>
          {link ? (
            <Reveal link={`${link}&next=${k.next}`} />
          ) : (
            <p className="rounded-[10px] bg-alert-soft px-3 py-2 text-sm font-bold text-danger">KIOSK_TOKEN não está configurado no servidor.</p>
          )}
        </Card>
      ))}
      <p className="max-w-[760px] text-xs font-bold text-muted">
        Trate estes links como uma palavra-passe: quem os tiver consegue ver a lista de beneficiários no quiosque. Para os revogar, mude o KIOSK_TOKEN no Vercel e
        volte a emparelhar as duas Surfaces.
      </p>
    </>
  );
}
