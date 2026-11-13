import { NextResponse, type NextRequest } from "next/server";
import { UUID_RE, isKiosk, pickTime, unauthorized } from "@/lib/kiosk";
import { db } from "@/lib/supabase/admin";
import { lisbonDate } from "@/lib/domain";

type Body = { taskId?: string; done?: unknown; changedAt?: string };

// Mark a task done or reopen it, for the day the tap happened. The latest tap wins,
// so replaying an offline queue in any order ends in the right state.
export async function POST(request: NextRequest) {
  if (!(await isKiosk())) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.taskId || !UUID_RE.test(body.taskId)) return NextResponse.json({ error: "invalid_task" }, { status: 400 });
  const done = body.done === true;
  const at = pickTime(body.changedAt);
  const day = lisbonDate(at);

  const supabase = db();
  const { data: task } = await supabase.from("tasks").select("id, schedule").eq("id", body.taskId).maybeSingle();
  if (!task) return NextResponse.json({ error: "task_not_found" }, { status: 404 });

  const { data: row } = await supabase
    .from("task_completions")
    .select("done, completed_at, reopened, changed_at")
    .eq("task_id", task.id)
    .eq("day", day)
    .maybeSingle();

  if (row && Date.parse(row.changed_at) >= at.getTime()) {
    return NextResponse.json({ status: "ok", done: row.done }); // A newer tap already won.
  }

  const next = {
    task_id: task.id,
    day,
    schedule: task.schedule,
    done,
    completed_at: done ? at.toISOString() : (row?.completed_at ?? null),
    reopened: done ? (row?.reopened ?? false) : !!row?.done || !!row?.reopened,
    changed_at: at.toISOString(),
  };
  const { error } = await supabase.from("task_completions").upsert(next, { onConflict: "task_id,day" });
  if (error) {
    console.error("task upsert failed", error);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  return NextResponse.json({ status: "ok", done });
}
