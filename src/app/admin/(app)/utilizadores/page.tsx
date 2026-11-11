import type { Metadata } from "next";
import { ROLE_LABEL, requireProfile, type Role } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { lisbonDate, lisbonTime } from "@/lib/domain";
import { formatDay } from "@/lib/period";
import { Card, PageHeader } from "../../ui";
import { changeRole } from "./actions";
import { InviteForm, RowActions } from "./client";

export const metadata: Metadata = { title: "Utilizadores · Refood" };

function lastSeen(iso?: string | null) {
  if (!iso) return "Nunca entrou";
  return lisbonDate(iso) === lisbonDate() ? `Hoje, ${lisbonTime(iso)}` : formatDay(lisbonDate(iso), { day: "numeric", month: "short", year: "numeric" });
}

export default async function UsersPage() {
  const me = await requireProfile(["administrador"]);
  const [{ data: profiles }, { data: auth }] = await Promise.all([
    db().from("profiles").select("user_id, email, name, role").order("name"),
    db().auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const signIns = new Map((auth?.users ?? []).map((u) => [u.id, u.last_sign_in_at]));

  return (
    <>
      <PageHeader title="Utilizadores e perfis" subtitle="Só o Administrador vê esta página. Só entram pessoas convidadas." />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
        <Card className="flex flex-col gap-2 px-5 py-4">
          <span className="self-start rounded-full bg-peach px-2.5 py-1 text-xs font-black text-clay">Administrador</span>
          <span className="text-[15px] font-extrabold">Acesso a tudo</span>
          <span className="text-[13px] font-semibold leading-relaxed text-quiet">Painel, beneficiários, registos, quiosques e utilizadores.</span>
        </Card>
        <Card className="flex flex-col gap-2 px-5 py-4">
          <span className="self-start rounded-full bg-leaf-soft px-2.5 py-1 text-xs font-black text-leaf-deep">Gestor Beneficiários</span>
          <span className="text-[15px] font-extrabold">Só beneficiários</span>
          <span className="text-[13px] font-semibold leading-relaxed text-quiet">Criar, editar e consultar fichas de beneficiários. Não vê o painel nem as outras páginas.</span>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="border-b border-line px-[18px] py-3 font-extrabold">Nome</th>
              <th className="border-b border-line px-[18px] py-3 font-extrabold">Email</th>
              <th className="border-b border-line px-[18px] py-3 font-extrabold">Perfil</th>
              <th className="border-b border-line px-[18px] py-3 font-extrabold">Último acesso</th>
              <th className="border-b border-line px-[18px] py-3 text-right font-extrabold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => {
              const self = p.user_id === me.userId;
              return (
                <tr key={p.user_id} className="align-top">
                  <td className="border-b border-line-soft px-[18px] py-3 font-extrabold">
                    {p.name || "—"}
                    {self && <span className="ml-1.5 text-xs font-bold text-muted">(você)</span>}
                  </td>
                  <td className="border-b border-line-soft px-[18px] py-3 font-semibold text-quiet">{p.email}</td>
                  <td className="border-b border-line-soft px-[18px] py-3">
                    {self ? (
                      <span className="rounded-full bg-peach px-2.5 py-1 text-xs font-black text-clay">{ROLE_LABEL[p.role as Role]}</span>
                    ) : (
                      <form action={changeRole.bind(null, p.user_id)} className="flex items-center gap-1.5">
                        <select name="role" defaultValue={p.role} aria-label="Perfil" className="rounded-lg border border-line-strong bg-white px-2 py-1.5 text-[13px] font-bold">
                          <option value="administrador">Administrador</option>
                          <option value="gestor_beneficiarios">Gestor Beneficiários</option>
                        </select>
                        <button type="submit" className="h-[32px] rounded-lg border border-line-strong bg-white px-2.5 text-[13px] font-extrabold hover:bg-ground">
                          Mudar perfil
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="border-b border-line-soft px-[18px] py-3 font-semibold text-quiet">{lastSeen(signIns.get(p.user_id))}</td>
                  <td className="border-b border-line-soft px-[18px] py-2">
                    <RowActions userId={p.user_id} self={self} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card className="max-w-[640px] p-6">
        <h2 className="mb-4 text-[19px] font-black">Convidar utilizador</h2>
        <InviteForm />
      </Card>
    </>
  );
}
