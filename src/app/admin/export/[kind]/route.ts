import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { fetchCheckIns, fetchEvents, toCsv } from "@/lib/events";
import { BENEFICIARY_TYPE_LABEL, EVENT_TYPE_LABEL, SCHEDULE_LABEL, lisbonDate, lisbonTime, padNumber } from "@/lib/domain";
import { resolveRange } from "@/lib/period";

function csvResponse(name: string, body: string) {
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}

export async function GET(request: NextRequest, ctx: RouteContext<"/admin/export/[kind]">) {
  const profile = await getProfile();
  if (!profile) return NextResponse.redirect(new URL("/admin/login", request.url));
  const { kind } = await ctx.params;
  const sp = request.nextUrl.searchParams;

  if (kind === "beneficiarios") {
    const { data } = await db().from("beneficiaries").select("*").order("name");
    const rows = [
      ["N.º", "Nome", "Tipo", "Adultos", "Crianças", "Alimentação", "Notas", "Estado"],
      ...(data ?? []).map((b) => [
        padNumber(b.number),
        b.name,
        BENEFICIARY_TYPE_LABEL[b.type as "familia"],
        b.adults,
        b.children,
        (b.food_needs ?? []).join(", "),
        b.food_notes,
        b.active ? "Ativo" : "Inativo",
      ]),
    ];
    return csvResponse(`beneficiarios-${lisbonDate()}.csv`, toCsv(rows));
  }

  if (kind === "atendimentos") {
    if (profile.role !== "administrador") return new NextResponse("Sem acesso", { status: 403 });
    const range = resolveRange("pers", sp.get("de") ?? undefined, sp.get("ate") ?? undefined);
    const tipo = sp.get("tipo");
    const events = await fetchEvents({
      start: range.start,
      end: range.end,
      includeUndone: sp.get("anulados") === "1",
      type: tipo === "inscrito" || tipo === "nao_inscrito" ? tipo : undefined,
    });
    const rows = [
      ["Data", "Hora", "Tipo", "N.º beneficiário", "Beneficiário", "Pessoas", "Quiosque", "Anulado"],
      ...events
        .slice()
        .reverse()
        .map((e) => [
          lisbonDate(e.recorded_at),
          lisbonTime(e.recorded_at),
          EVENT_TYPE_LABEL[e.type],
          e.beneficiaries ? padNumber(e.beneficiaries.number) : "",
          e.beneficiaries?.name ?? "",
          e.people,
          e.kiosk_id,
          e.undone ? "Sim" : "Não",
        ]),
    ];
    return csvResponse(`atendimentos-${range.from}-a-${range.to}.csv`, toCsv(rows));
  }

  if (profile.role !== "administrador") return new NextResponse("Sem acesso", { status: 403 });

  if (kind === "voluntarios") {
    const { data } = await db().from("volunteers").select("number, name, phone, email, active, created_at").order("number");
    const rows = [
      ["N.º", "Nome", "Telefone", "Email", "Estado", "Desde"],
      ...(data ?? []).map((v) => [v.number, v.name, v.phone, v.email, v.active ? "Ativo" : "Inativo", lisbonDate(v.created_at)]),
    ];
    return csvResponse(`voluntarios-${lisbonDate()}.csv`, toCsv(rows));
  }

  if (kind === "entradas") {
    const range = resolveRange("pers", sp.get("de") ?? undefined, sp.get("ate") ?? undefined);
    const t = sp.get("turno");
    const rows = await fetchCheckIns({ start: range.start, end: range.end, schedule: t === "1" ? 1 : t === "2" ? 2 : undefined });
    const out = [
      ["Data", "Hora", "N.º voluntário", "Voluntário", "Turno"],
      ...rows
        .slice()
        .reverse()
        .map((c) => [lisbonDate(c.checked_in_at), lisbonTime(c.checked_in_at), c.volunteers?.number ?? "", c.volunteers?.name ?? "", SCHEDULE_LABEL[c.schedule].pt]),
    ];
    return csvResponse(`entradas-${range.from}-a-${range.to}.csv`, toCsv(out));
  }

  if (kind === "tarefas") {
    const range = resolveRange("pers", sp.get("de") ?? undefined, sp.get("ate") ?? undefined);
    const { data } = await db()
      .from("task_completions")
      .select("day, schedule, done, completed_at, reopened, tasks(name)")
      .gte("day", range.from)
      .lte("day", range.to)
      .order("day");
    const out = [
      ["Dia", "Turno", "Tarefa", "Estado", "Concluída às", "Reaberta"],
      ...(data ?? []).map((r) => [
        r.day,
        SCHEDULE_LABEL[r.schedule as 1 | 2].pt,
        (r.tasks as unknown as { name: string } | null)?.name ?? "",
        r.done ? "Concluída" : "Por fazer",
        r.done && r.completed_at ? lisbonTime(r.completed_at) : "",
        r.reopened ? "Sim" : "Não",
      ]),
    ];
    return csvResponse(`tarefas-${range.from}-a-${range.to}.csv`, toCsv(out));
  }

  return new NextResponse("Not found", { status: 404 });
}
