import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { formatDay } from "@/lib/period";
import { lisbonDate } from "@/lib/domain";
import PrintButton from "./print-button";

export const metadata: Metadata = { title: "Lista de voluntários · Refood" };

// A plain page to print (or save as PDF) so volunteers can be told their number.
export default async function PrintVolunteers() {
  await requireProfile(["administrador"]);
  const { data } = await db().from("volunteers").select("number, name").eq("active", true).order("name");
  const rows = data ?? [];
  return (
    <div className="flex max-w-[760px] flex-col gap-4">
      <div className="flex items-center gap-3 print:hidden">
        <h1 className="mr-auto text-[28px] font-black">Lista de voluntários</h1>
        <PrintButton />
      </div>
      <p className="text-sm font-bold text-muted">
        Voluntários ativos · {rows.length} · {formatDay(lisbonDate(), { day: "numeric", month: "long", year: "numeric" })}. Use o número para fazer a entrada no quiosque.
      </p>
      <table className="w-full border-collapse text-[15px]">
        <thead>
          <tr className="text-left">
            <th className="w-24 border-b-2 border-ink py-2 font-black">N.º</th>
            <th className="border-b-2 border-ink py-2 font-black">Nome</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.number} className="break-inside-avoid">
              <td className="border-b border-line py-1.5 text-[18px] font-black">{v.number}</td>
              <td className="border-b border-line py-1.5 font-bold">{v.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
