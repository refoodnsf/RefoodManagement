"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SCHEDULE_LABEL, autoSchedule, firstName, initials, lisbonTime, type Schedule } from "@/lib/domain";
import { BackButton, Bi, CheckIcon, Countdown, OfflineBadge, Stage } from "../s1/ui";
import { useS2, type Contact, type Slide, type Task } from "./use-s2";
import Camera from "./camera";
import EventCard from "./event-card";

type Screen =
  | { name: "painel" }
  | { name: "tarefas" }
  | { name: "concluida"; task: string }
  | { name: "numero"; error?: boolean }
  | { name: "estu"; number: number; name_: string | null; alreadyAt: string | null }
  | { name: "bemvindo"; name_: string | null; schedule: Schedule; at: string }
  | { name: "emergencia" }
  | { name: "foto" };

const IDLE_MS = 60_000;
const SLIDE_MS = 8_000;

function useNow(everyMs = 15_000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(new Date()), 0);
    const timer = setInterval(() => setNow(new Date()), everyMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [everyMs]);
  return now;
}

export default function Kiosk() {
  const s2 = useS2();
  const now = useNow();
  const [screen, setScreen] = useState<Screen>({ name: "painel" });
  const [manual, setManual] = useState<Schedule | null>(null);
  const lastTouch = useRef(0);

  const auto = autoSchedule(now ?? new Date());
  const schedule = manual ?? auto;
  const home = useCallback(() => setScreen({ name: "painel" }), []);

  // After 60 s without a touch: back to the dashboard and to the automatic schedule.
  useEffect(() => {
    lastTouch.current = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - lastTouch.current > IDLE_MS) {
        setScreen((s) => (s.name === "painel" ? s : { name: "painel" }));
        setManual(null);
      }
    }, 5_000);
    return () => clearInterval(timer);
  }, []);

  const tasks = s2.tasks.filter((t) => t.schedule === schedule);
  const done = tasks.filter((t) => s2.status[t.id]).length;

  return (
    <Stage>
      <div className="h-full w-full" onPointerDown={() => (lastTouch.current = Date.now())}>
        {screen.name === "painel" && (
          <Painel
            now={now}
            schedule={schedule}
            automatic={manual === null}
            onSchedule={(s) => setManual(s === auto ? null : s)}
            done={done}
            total={tasks.length}
            slides={s2.slides}
            go={(name) => setScreen({ name } as Screen)}
          />
        )}
        {screen.name === "tarefas" && (
          <Tarefas
            schedule={schedule}
            tasks={tasks}
            status={s2.status}
            onBack={home}
            onSet={(t, value) => {
              s2.setTask(t.id, value);
              if (value) setScreen({ name: "concluida", task: t.name });
            }}
          />
        )}
        {screen.name === "concluida" && <Concluida task={screen.task} onDone={() => setScreen({ name: "tarefas" })} />}
        {screen.name === "numero" && (
          <Numero
            key={String(screen.error)}
            error={!!screen.error}
            onBack={home}
            onSubmit={async (number) => {
              const r = await s2.lookup(number);
              if (r.status === "not_found") return setScreen({ name: "numero", error: true });
              const local = s2.checkedInAt(number) ?? null;
              setScreen({
                name: "estu",
                number,
                name_: r.status === "ok" ? r.name : null,
                alreadyAt: (r.status === "ok" ? r.alreadyAt : null) ?? local,
              });
            }}
          />
        )}
        {screen.name === "estu" && (
          <EsTu
            key={screen.alreadyAt ?? "new"}
            number={screen.number}
            name={screen.name_}
            alreadyAt={screen.alreadyAt}
            onNo={() => setScreen({ name: "numero" })}
            onHome={home}
            onYes={async () => {
              const r = await s2.checkIn(screen.number, schedule);
              if (r.status === "not_found") return setScreen({ name: "numero", error: true });
              if (r.status === "already") return setScreen({ ...screen, alreadyAt: r.at ?? new Date().toISOString() });
              setScreen({ name: "bemvindo", name_: r.name ?? screen.name_, schedule, at: new Date().toISOString() });
            }}
          />
        )}
        {screen.name === "bemvindo" && <BemVindo name={screen.name_} schedule={screen.schedule} at={screen.at} onDone={home} />}
        {screen.name === "emergencia" && <Emergencia contacts={s2.contacts} onBack={home} />}
        {screen.name === "foto" && <Camera onBack={home} upload={s2.uploadPhoto} />}
        {!s2.online && (
          <OfflineBadge position={`left-1/2 -translate-x-1/2 ${screen.name === "painel" ? "top-[132px]" : "bottom-[24px]"}`} />
        )}
      </div>
    </Stage>
  );
}

/* ------------------------------------------------------------------ */
/* 2.1 Painel                                                          */
/* ------------------------------------------------------------------ */

function Painel({
  now,
  schedule,
  automatic,
  onSchedule,
  done,
  total,
  slides,
  go,
}: {
  now: Date | null;
  schedule: Schedule;
  automatic: boolean;
  onSchedule: (s: Schedule) => void;
  done: number;
  total: number;
  slides: Slide[];
  go: (name: "tarefas" | "numero" | "emergencia" | "foto") => void;
}) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done >= total;
  const level = pct <= 40 ? 0 : pct <= 80 ? 1 : 2;
  return (
    <div className="flex h-full flex-col gap-[28px] px-[48px] pb-[40px] pt-[32px]">
      <div className="flex h-[92px] items-center justify-between">
        <div className="flex w-[300px] items-center gap-[16px]">
          <div className="flex h-[60px] w-[60px] items-center justify-center rounded-[20px] bg-leaf text-white">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 20c0-9 6-15 15-15 0 9-6 15-15 15z" />
              <path d="M5 20l8-8" />
            </svg>
          </div>
          <Bi pt="Refood" en="Voluntários · Volunteers" ptClass="text-[28px] font-black" enClass="text-[18px] text-muted" />
        </div>

        <div role="group" aria-label="Turno" className="flex gap-[6px] rounded-[30px] border-2 border-line bg-white p-[6px]">
          {([1, 2] as Schedule[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={schedule === s}
              onClick={() => onSchedule(s)}
              className={`tap flex h-[80px] w-[260px] flex-col items-center justify-center rounded-[24px] leading-[1.1] ${
                schedule === s ? "bg-leaf text-white" : "bg-transparent text-ink"
              }`}
            >
              <span className="text-[28px] font-black">{SCHEDULE_LABEL[s].pt}</span>
              <span className="text-[16px] font-semibold opacity-85">{SCHEDULE_LABEL[s].en}</span>
            </button>
          ))}
        </div>

        <div className="flex w-[300px] flex-col items-end leading-[1.15]">
          <span className="text-[40px] font-black">{now ? lisbonTime(now) : ""}</span>
          {automatic ? (
            <span className="flex items-center gap-[6px] text-[16px] font-bold text-muted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              turno automático
            </span>
          ) : (
            <span className="text-[16px] font-bold text-muted">escolhido à mão · volta sozinho</span>
          )}
        </div>
      </div>

      <div className="flex h-[480px] gap-[28px]">
        <button
          type="button"
          onClick={() => go("tarefas")}
          className={`tap flex h-[480px] w-[440px] shrink-0 flex-col justify-between rounded-[36px] px-[36px] py-[32px] text-left ${
            complete ? "bg-peach" : "border-2 border-line bg-white"
          }`}
        >
          <Bi
            pt={complete ? "Turno completo!" : "Tarefas concluídas"}
            en={complete ? "Shift complete!" : total === 0 ? "No tasks in this schedule yet" : "Tasks completed"}
            ptClass="text-[32px] font-extrabold"
            enClass={`text-[18px] ${complete ? "text-clay-text" : "text-muted"}`}
          />
          <span className="flex items-center justify-between gap-[12px]">
            <span className="flex items-baseline gap-[4px] leading-none">
              <span className="text-[120px] font-black tracking-[-3px]">{done}</span>
              <span className={`text-[64px] font-extrabold ${complete ? "text-clay-text" : "text-muted"}`}>/{total}</span>
            </span>
            <Face level={level} pct={pct} />
          </span>
          <span
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            className={`block h-[36px] w-full overflow-hidden rounded-[18px] ${complete ? "bg-white" : "bg-leaf-soft"}`}
          >
            <span className="block h-[36px] rounded-[18px] bg-leaf transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </span>
        </button>

        <PhotoPanel slides={slides} />
      </div>

      <div className="grid flex-1 grid-cols-4 gap-[24px]">
        <BigButton onClick={() => go("tarefas")} pt="Registar tarefa" en="Record task" icon="tarefa" />
        <BigButton onClick={() => go("numero")} pt="Entrada de voluntário" en="Volunteer check-in" icon="entrada" />
        <BigButton onClick={() => go("emergencia")} pt="Contactos de emergência" en="Emergency contacts" icon="emergencia" tone="emergency" />
        <BigButton onClick={() => go("foto")} pt="Carregar fotos" en="Upload photos" icon="foto" tone="light" />
      </div>
    </div>
  );
}

function Face({ level, pct }: { level: number; pct: number }) {
  const label = ["Triste", "Contente", "Muito contente"][level] + ` · ${pct}%`;
  return (
    <span role="img" aria-label={label} className="h-[132px] w-[132px] shrink-0">
      {level === 0 && (
        <svg width="132" height="132" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10.5" fill="#FDEBD8" stroke="#C77A2E" strokeWidth="1.2" />
          <circle cx="8.8" cy="10" r="1.2" fill="#8A4A12" />
          <circle cx="15.2" cy="10" r="1.2" fill="#8A4A12" />
          <path d="M8 17c1.1-1.6 2.4-2.3 4-2.3s2.9.7 4 2.3" fill="none" stroke="#8A4A12" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}
      {level === 1 && (
        <svg width="132" height="132" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10.5" fill="#E4F1E8" stroke="#2E7D4F" strokeWidth="1.2" />
          <circle cx="8.8" cy="10" r="1.2" fill="#1A4D30" />
          <circle cx="15.2" cy="10" r="1.2" fill="#1A4D30" />
          <path d="M8 14.3c1.1 1.6 2.4 2.3 4 2.3s2.9-.7 4-2.3" fill="none" stroke="#1A4D30" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}
      {level === 2 && (
        <svg width="132" height="132" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10.5" fill="#F2A65A" stroke="#1E5A38" strokeWidth="1.2" />
          <path d="M7.4 10.2c.6-1.2 1.8-1.2 2.4 0M14.2 10.2c.6-1.2 1.8-1.2 2.4 0" fill="none" stroke="#1F2A22" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M6.8 13.2h10.4c0 3-2.3 5.2-5.2 5.2s-5.2-2.2-5.2-5.2z" fill="#1F2A22" />
          <path d="M9 16.6c.9.6 1.9.9 3 .9s2.1-.3 3-.9" fill="none" stroke="#F2A65A" strokeWidth="1" />
        </svg>
      )}
    </span>
  );
}

const ICONS = {
  tarefa: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3h6v3H9z" />
      <path d="M9 13l2 2 4-4" />
    </>
  ),
  entrada: (
    <>
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 3.5 1.1" />
      <path d="M16 19l2 2 4-4" />
    </>
  ),
  emergencia: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  foto: (
    <>
      <path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
};

function BigButton({
  onClick,
  pt,
  en,
  icon,
  tone = "primary",
}: {
  onClick: () => void;
  pt: string;
  en: string;
  icon: keyof typeof ICONS;
  tone?: "primary" | "emergency" | "light";
}) {
  const styles = {
    primary: "bg-leaf text-white shadow-[0_6px_0_#1e5a38]",
    emergency: "border-[3px] border-[#f0b8b0] bg-[#fbe7e4] text-danger shadow-[0_6px_0_#f0b8b0]",
    light: "border-[3px] border-leaf-line bg-white text-ink shadow-[0_6px_0_#cfe3d6]",
  }[tone];
  const enColor = { primary: "text-leaf-mist", emergency: "text-[#8c3a30]", light: "text-muted" }[tone];
  return (
    <button type="button" onClick={onClick} className={`tap flex flex-col items-center justify-center gap-[12px] rounded-[32px] ${styles}`}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={tone === "light" ? "#2E7D4F" : "currentColor"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONS[icon]}
      </svg>
      <Bi pt={pt} en={en} align="center" ptClass="text-[30px] font-black" enClass={`text-[18px] ${enColor}`} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Photo panel + 2.10 event card                                       */
/* ------------------------------------------------------------------ */

function PhotoPanel({ slides }: { slides: Slide[] }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setTick((t) => t + 1), SLIDE_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  const n = slides.length;
  const idx = n ? tick % n : 0;
  const prev = n > 1 ? (idx - 1 + n) % n : -1;

  return (
    <div className="relative h-[480px] min-w-0 flex-1 overflow-hidden rounded-[36px] bg-[#dce9df]">
      {n === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-[14px] text-[#2e5e40]">
          <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="M21 16l-5-5-9 9" />
          </svg>
          <Bi pt="Ainda não há fotos" en="No photos yet · tap “Carregar fotos”" align="center" ptClass="text-[28px] font-black" enClass="text-[18px]" />
        </div>
      ) : (
        slides.map((s, i) =>
          i === idx || i === prev ? (
            <div key={s.id} className={`absolute inset-0 ${i === idx ? "fade-in z-10" : "z-0"}`}>
              {s.kind === "photo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.url} alt="" className="h-full w-full object-cover" draggable={false} />
              ) : (
                <EventCard slide={s} />
              )}
            </div>
          ) : null,
        )
      )}
      {n > 1 && n <= 14 && (
        <div aria-hidden="true" className="absolute inset-x-0 bottom-[22px] z-20 flex justify-center gap-[10px]">
          {slides.map((s, i) => (
            <span key={s.id} className={`h-[10px] rounded-[5px] ${i === idx ? "w-[28px] bg-white" : "w-[10px] bg-white/60"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2.2 Lista de tarefas · 2.3 Confirmar · details pop-up               */
/* ------------------------------------------------------------------ */

function Tarefas({
  schedule,
  tasks,
  status,
  onBack,
  onSet,
}: {
  schedule: Schedule;
  tasks: Task[];
  status: Record<string, boolean>;
  onBack: () => void;
  onSet: (t: Task, done: boolean) => void;
}) {
  const [details, setDetails] = useState<Task | null>(null);
  const [confirm, setConfirm] = useState<Task | null>(null);
  const done = tasks.filter((t) => status[t.id]).length;
  const all = tasks.length > 0 && done === tasks.length;

  return (
    <div className="relative flex h-full flex-col gap-[24px] px-[48px] pt-[32px]">
      <div className="flex shrink-0 items-center gap-[32px]">
        <BackButton onClick={onBack} />
        <Bi pt={<h1 className="text-[48px] font-black">{SCHEDULE_LABEL[schedule].pt}</h1>} en={SCHEDULE_LABEL[schedule].en} enClass="text-[24px] text-muted" />
        <div className="ml-auto flex items-center gap-[20px]">
          <Bi pt="Tarefas concluídas" en="Tasks completed" align="end" ptClass="text-[24px] font-extrabold" enClass="text-[16px] text-muted" />
          <span className="text-[56px] font-black">
            {done}/{tasks.length}
          </span>
        </div>
      </div>

      {all && (
        <div className="flex shrink-0 items-center gap-[20px] rounded-[24px] bg-leaf-soft px-[28px] py-[18px] text-leaf-deep">
          <CheckIcon size={40} stroke={2.8} />
          <Bi pt="Turno completo! Obrigado!" en="Shift complete! Thank you!" ptClass="text-[30px] font-black" enClass="text-[18px] text-[#2e5e40]" />
        </div>
      )}

      <div className="kiosk-scroll flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto pb-[32px] pr-[8px]">
        {tasks.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center text-muted">
            <Bi pt="Ainda não há tarefas neste turno" en="No tasks in this schedule yet · ask a coordinator" align="center" ptClass="text-[36px] font-black text-ink" enClass="text-[20px]" />
          </div>
        )}
        {tasks.map((t) => {
          const isDone = !!status[t.id];
          return (
            <div key={t.id} className="flex min-h-[112px] shrink-0 items-center gap-[20px] rounded-[28px] border-2 border-line bg-white py-[12px] pl-[28px] pr-[14px]">
              {isDone ? (
                <span className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full bg-leaf text-white">
                  <CheckIcon size={34} />
                </span>
              ) : (
                <span className="h-[56px] w-[56px] shrink-0 rounded-full border-4 border-line-strong" />
              )}
              <span className="flex min-w-0 flex-1 flex-col leading-[1.15]">
                <span className={`text-[32px] font-extrabold ${isDone ? "text-muted" : ""}`}>{t.name}</span>
                {t.photos.length > 0 && (
                  <span className="flex items-center gap-[6px] text-[17px] font-bold text-muted">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <circle cx="9" cy="10" r="2" />
                      <path d="M21 16l-5-5-9 9" />
                    </svg>
                    {t.photos.length} {t.photos.length === 1 ? "foto" : "fotos"}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setDetails(t)}
                className="tap flex h-[80px] w-[180px] shrink-0 flex-col items-center justify-center rounded-[22px] border-2 border-line-strong bg-white leading-[1.1] text-ink"
              >
                <span className="text-[22px] font-extrabold">Ver detalhes</span>
                <span className="text-[14px] font-semibold text-muted">See details</span>
              </button>
              {isDone ? (
                <button
                  type="button"
                  onClick={() => setConfirm(t)}
                  aria-label="Concluído — tocar para reabrir"
                  className="tap flex h-[88px] w-[250px] shrink-0 items-center justify-center gap-[12px] rounded-[24px] border-2 border-[#9ccbae] bg-leaf-soft leading-[1.1] text-leaf-deep"
                >
                  <CheckIcon size={32} />
                  <Bi pt="Concluído" en="Done" ptClass="text-[30px] font-black" enClass="text-[15px] text-[#2e5e40]" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirm(t)}
                  className="tap flex h-[88px] w-[250px] shrink-0 flex-col items-center justify-center rounded-[24px] bg-leaf leading-[1.1] text-white shadow-[0_4px_0_#1e5a38]"
                >
                  <span className="text-[32px] font-black">Concluir</span>
                  <span className="text-[16px] font-semibold text-leaf-mist">Complete</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {details && (
        <Details
          task={details}
          done={!!status[details.id]}
          onClose={() => setDetails(null)}
          onComplete={() => {
            setConfirm(details);
            setDetails(null);
          }}
        />
      )}
      {confirm && (
        <Confirm
          task={confirm}
          reopen={!!status[confirm.id]}
          onNo={() => setConfirm(null)}
          onYes={() => {
            const t = confirm;
            setConfirm(null);
            onSet(t, !status[t.id]);
          }}
        />
      )}
    </div>
  );
}

function Details({ task, done, onClose, onComplete }: { task: Task; done: boolean; onClose: () => void; onComplete: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[rgba(31,42,34,.62)]">
      <div role="dialog" aria-modal="true" aria-labelledby="det-titulo" className="flex max-h-[820px] w-[1080px] flex-col gap-[24px] rounded-[40px] bg-ground px-[48px] py-[40px]">
        <div className="flex items-start gap-[24px]">
          <span className="flex min-w-0 flex-1 flex-col leading-[1.15]">
            <span className="text-[20px] font-extrabold text-muted">Detalhes da tarefa · Task details</span>
            <h2 id="det-titulo" className="mt-[4px] text-[48px] font-black">
              {task.name}
            </h2>
          </span>
          <button type="button" onClick={onClose} className="tap flex h-[88px] shrink-0 items-center gap-[12px] rounded-[24px] border-2 border-line-strong bg-white px-[30px] text-ink">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            <Bi pt="Fechar" en="Close" ptClass="text-[28px] font-black" enClass="text-[15px] text-muted" />
          </button>
        </div>
        <div className="kiosk-scroll flex min-h-0 flex-col gap-[24px] overflow-y-auto">
          <p className="whitespace-pre-line text-[28px] font-semibold leading-[1.4]">
            {task.details || <span className="text-muted">Sem detalhes. · No details.</span>}
          </p>
          {task.photos.length > 0 && (
            <div className="grid grid-cols-3 gap-[16px]">
              {task.photos.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="" className="h-[220px] w-full rounded-[24px] bg-[#dce9df] object-cover" draggable={false} />
              ))}
            </div>
          )}
        </div>
        {!done && (
          <button
            type="button"
            onClick={onComplete}
            className="tap flex h-[100px] w-[320px] shrink-0 flex-col items-center justify-center self-end rounded-[28px] bg-leaf leading-[1.1] text-white shadow-[0_5px_0_#1e5a38]"
          >
            <span className="text-[36px] font-black">Concluir</span>
            <span className="text-[18px] font-semibold text-leaf-mist">Complete</span>
          </button>
        )}
      </div>
    </div>
  );
}

function YesNo({ onNo, onYes, height = 150 }: { onNo: () => void; onYes: () => void; height?: number }) {
  const busy = useRef(false);
  return (
    <div className="grid w-full grid-cols-2 gap-[28px]">
      <button
        type="button"
        onClick={onNo}
        style={{ height }}
        className="tap flex items-center justify-center gap-[20px] rounded-[34px] border-[3px] border-line-strong bg-white text-ink"
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
        <Bi pt="Não" en="No" ptClass="text-[56px] font-black" enClass="text-[24px] text-muted" />
      </button>
      <button
        type="button"
        onClick={() => {
          if (busy.current) return; // A double tap never records twice.
          busy.current = true;
          onYes();
        }}
        style={{ height }}
        className="tap flex items-center justify-center gap-[20px] rounded-[34px] bg-leaf text-white shadow-[0_6px_0_#1e5a38]"
      >
        <CheckIcon size={52} />
        <Bi pt="Sim" en="Yes" ptClass="text-[56px] font-black" enClass="text-[24px] text-leaf-mist" />
      </button>
    </div>
  );
}

function Confirm({ task, reopen, onNo, onYes }: { task: Task; reopen: boolean; onNo: () => void; onYes: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#4b544d]/90">
      <div role="dialog" aria-modal="true" aria-labelledby="pergunta" className="flex w-[960px] flex-col items-center gap-[36px] rounded-[44px] bg-ground px-[64px] py-[56px] shadow-[0_30px_80px_rgba(0,0,0,.25)]">
        <Bi
          pt={
            <h1 id="pergunta" className="text-[48px] font-black">
              {reopen ? "Reabrir esta tarefa?" : "Confirmar que a tarefa está concluída?"}
            </h1>
          }
          en={reopen ? "Reopen this task? It goes back to “Por fazer”." : "Confirm this task is done?"}
          align="center"
          enClass="text-[26px] text-muted"
        />
        <div className="flex w-full items-center gap-[20px] rounded-[28px] border-2 border-line bg-white px-[36px] py-[24px]">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2E7D4F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS.tarefa}
          </svg>
          <span className="text-[40px] font-black">{task.name}</span>
        </div>
        <YesNo onNo={onNo} onYes={onYes} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2.4 Tarefa concluída                                                */
/* ------------------------------------------------------------------ */

function Concluida({ task, onDone }: { task: string; onDone: () => void }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-[32px]">
      <span className="pop flex h-[220px] w-[220px] items-center justify-center rounded-full bg-leaf text-white shadow-[0_0_0_26px_#e4f1e8]">
        <CheckIcon size={130} />
      </span>
      <span className="mt-[16px]">
        <Bi pt={<span className="text-[104px] font-black leading-[1.05]">Obrigado!</span>} en="Thank you!" align="center" enClass="text-[42px] text-muted" />
      </span>
      <span className="flex items-center gap-[14px] rounded-[22px] border-2 border-line bg-white px-[30px] py-[16px] text-leaf">
        <CheckIcon size={32} stroke={2.6} />
        <span className="text-[32px] font-extrabold text-ink">{task}</span>
      </span>
      <Countdown seconds={3} onDone={onDone} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2.5 Entrada: número                                                 */
/* ------------------------------------------------------------------ */

function Numero({ error, onBack, onSubmit }: { error: boolean; onBack: () => void; onSubmit: (n: number) => Promise<void> }) {
  const [digits, setDigits] = useState("");
  const [showError, setShowError] = useState(error);
  const [busy, setBusy] = useState(false);
  const press = (k: string) => {
    setShowError(false);
    setDigits((d) => (k === "del" ? d.slice(0, -1) : d.length < 4 ? (d + k).replace(/^0+/, "") : d));
  };
  const empty = digits.length === 0;
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", ""];

  return (
    <div className="flex h-full gap-[48px] px-[48px] pb-[40px] pt-[32px]">
      <div className="flex flex-1 flex-col gap-[32px]">
        <span className="self-start">
          <BackButton onClick={onBack} />
        </span>
        <Bi pt={<h1 className="text-[48px] font-black">Qual é o teu número de voluntário?</h1>} en="What is your volunteer number?" enClass="text-[26px] text-muted" />
        <div aria-live="polite" className={`flex h-[200px] items-center justify-center rounded-[32px] bg-white ${showError ? "border-4 border-[#c0392b]" : "border-[3px] border-line"}`}>
          {empty ? (
            <span aria-hidden="true" className="text-[96px] font-extrabold tracking-[20px] text-line-strong">
              ····
            </span>
          ) : (
            <span className="text-[120px] font-black leading-none tracking-[16px]">{digits}</span>
          )}
        </div>
        {showError && (
          <div role="alert" className="flex items-center gap-[18px] rounded-[24px] bg-[#fbe7e4] px-[26px] py-[18px] text-danger">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v6M12 16.5v.5" />
            </svg>
            <Bi pt="Número não encontrado" en="Number not found · try again" ptClass="text-[30px] font-black" enClass="text-[18px] text-[#8c3a30]" />
          </div>
        )}
        <button
          type="button"
          disabled={empty || busy}
          onClick={async () => {
            setBusy(true);
            await onSubmit(Number(digits));
            setBusy(false);
          }}
          className={`tap mt-auto flex h-[132px] items-center justify-center gap-[24px] rounded-[34px] ${
            empty ? "bg-line text-muted" : "bg-leaf text-white shadow-[0_6px_0_#1e5a38]"
          }`}
        >
          <Bi pt={busy ? "A procurar…" : "Continuar"} en={busy ? "Searching…" : "Continue"} ptClass="text-[42px] font-black" enClass="text-[22px] opacity-85" />
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <div className="grid w-[600px] shrink-0 grid-cols-3 grid-rows-4 gap-[18px]">
        {keys.map((k, i) =>
          k === "" ? (
            <span key={i} aria-hidden="true" />
          ) : k === "del" ? (
            <button
              key={i}
              type="button"
              onClick={() => press("del")}
              aria-label="Apagar / Delete"
              className="tap flex flex-col items-center justify-center gap-[4px] rounded-[32px] border-[3px] border-line bg-sand text-ink"
            >
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" />
                <path d="M12 9l6 6M18 9l-6 6" />
              </svg>
              <span className="text-[18px] font-extrabold">Apagar</span>
            </button>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(k)}
              className="tap rounded-[32px] border-[3px] border-leaf-line bg-white text-[80px] font-black text-ink shadow-[0_6px_0_#cfe3d6]"
            >
              {k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2.6 Entrada: confirmar                                              */
/* ------------------------------------------------------------------ */

function EsTu({
  number,
  name,
  alreadyAt,
  onNo,
  onYes,
  onHome,
}: {
  number: number;
  name: string | null;
  alreadyAt: string | null;
  onNo: () => void;
  onYes: () => Promise<void>;
  onHome: () => void;
}) {
  return (
    <div className="flex h-full flex-col px-[48px] pb-[56px] pt-[32px]">
      <span className="self-start">
        <BackButton onClick={onNo} />
      </span>

      <div className="flex flex-1 flex-col items-center justify-center gap-[24px]">
        <Bi
          pt={<h1 className="text-[56px] font-black">{name ? "És tu?" : "Este é o teu número?"}</h1>}
          en={name ? "Is this you?" : "Is this your number?"}
          align="center"
          enClass="text-[28px] text-muted"
        />
        <div className="mt-[12px] flex items-center gap-[36px]">
          <span className="flex h-[150px] w-[150px] shrink-0 items-center justify-center rounded-full bg-leaf-soft text-[64px] font-black text-leaf-link">
            {name ? initials(name) : "N.º"}
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[120px] font-black tracking-[-2px]">{name ?? number}</span>
            <span className="mt-[12px] text-[30px] font-bold text-muted">
              {name ? `N.º ${number}` : "Sem ligação: o nome aparece quando a ligação voltar · Offline"}
            </span>
          </span>
        </div>
      </div>

      {alreadyAt ? (
        <div className="flex items-center gap-[32px]">
          <div role="status" className="flex h-[160px] flex-1 items-center gap-[24px] rounded-[36px] bg-peach px-[40px] text-clay">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5l3 3 5-6" />
            </svg>
            <Bi
              pt="Já fizeste a entrada hoje"
              en={`You already checked in today · ${lisbonTime(alreadyAt)}`}
              ptClass="text-[44px] font-black"
              enClass="text-[24px] text-clay-text"
            />
          </div>
          <button type="button" onClick={onHome} className="tap flex h-[160px] w-[380px] shrink-0 items-center justify-center gap-[18px] rounded-[36px] bg-leaf text-white shadow-[0_6px_0_#1e5a38]">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <Bi pt="Voltar" en="Back" ptClass="text-[48px] font-black" enClass="text-[22px] text-leaf-mist" />
          </button>
        </div>
      ) : (
        <YesNo onNo={onNo} onYes={() => void onYes()} height={160} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2.7 Entrada: boas-vindas                                            */
/* ------------------------------------------------------------------ */

function BemVindo({ name, schedule, at, onDone }: { name: string | null; schedule: Schedule; at: string; onDone: () => void }) {
  const first = name ? firstName(name) : "";
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-[36px] overflow-hidden">
      <span aria-hidden="true" className="absolute left-[180px] top-[140px] h-[28px] w-[28px] rounded-full bg-orange" />
      <span aria-hidden="true" className="absolute left-[300px] top-[640px] h-[40px] w-[18px] rotate-[35deg] rounded-[9px] bg-[#9ccbae]" />
      <span aria-hidden="true" className="absolute right-[220px] top-[180px] h-[22px] w-[22px] rotate-[20deg] rounded-[6px] bg-leaf" />
      <span aria-hidden="true" className="absolute right-[300px] top-[600px] h-[32px] w-[32px] rounded-full bg-peach" />
      <span className="pop flex h-[200px] w-[200px] items-center justify-center rounded-full bg-leaf text-white shadow-[0_0_0_24px_#e4f1e8]">
        <CheckIcon size={120} />
      </span>
      <span className="mt-[12px]">
        <Bi
          pt={<span className="text-[100px] font-black leading-[1.05] tracking-[-1px]">{first ? `Bem-vindo/a, ${first}!` : "Bem-vindo/a!"}</span>}
          en={first ? `Welcome, ${first}!` : "Welcome!"}
          align="center"
          enClass="text-[42px] text-muted"
        />
      </span>
      <span className="rounded-[18px] border-2 border-line bg-white px-[24px] py-[12px] text-[24px] font-bold text-muted">
        {SCHEDULE_LABEL[schedule].pt} · {lisbonTime(at)}
      </span>
      <Countdown seconds={3} onDone={onDone} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2.8 Contactos de emergência                                         */
/* ------------------------------------------------------------------ */

function Emergencia({ contacts, onBack }: { contacts: Contact[]; onBack: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[160px] shrink-0 items-center gap-[36px] bg-alert px-[48px] text-white">
        <span className="[&>button]:border-0">
          <BackButton onClick={onBack} />
        </span>
        <Bi pt={<h1 className="text-[56px] font-black">Contactos de emergência</h1>} en="Emergency contacts" enClass="text-[26px] text-alert-soft" />
      </div>
      {contacts.length > 0 ? (
        <div
          className="kiosk-scroll grid flex-1 grid-cols-2 gap-[20px] overflow-y-auto px-[48px] pb-[40px] pt-[32px]"
          style={{ gridTemplateRows: `repeat(${Math.max(3, Math.ceil(contacts.length / 2))}, minmax(150px, 1fr))` }}
        >
          {contacts.map((c) => (
            <div key={c.id} className="flex flex-col justify-center gap-[6px] rounded-[28px] border-2 border-line bg-white px-[32px] py-[22px]">
              <span className="flex flex-wrap items-baseline gap-[14px]">
                <span className="text-[32px] font-black">{c.name}</span>
                {c.note && <span className="text-[20px] font-bold text-muted">{c.note}</span>}
              </span>
              <span className="text-[64px] font-black leading-[1.05] tracking-[1px] text-danger">{c.phone}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-[20px] text-muted">
          <Bi pt="Ainda não há contactos" en="No contacts yet" align="center" ptClass="text-[40px] font-black text-ink" enClass="text-[22px]" />
          <Bi pt="Em caso de emergência ligue 112" en="In an emergency call 112" align="center" ptClass="mt-[20px] text-[24px] font-bold text-ink" enClass="text-[18px]" />
        </div>
      )}
    </div>
  );
}
