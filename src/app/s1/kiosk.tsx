"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BENEFICIARY_TYPE_LABEL, TZ, fold, initials, lisbonTime, padNumber } from "@/lib/domain";
import { useKiosk, type Beneficiary } from "./use-kiosk";
import {
  BackButton,
  Bi,
  CheckIcon,
  Countdown,
  OfflineBadge,
  RecordButton,
  Stage,
  UndoButton,
  UndoIcon,
} from "./ui";

type Screen =
  | { name: "painel" }
  | { name: "tipo" }
  | { name: "lista" }
  | { name: "obrigado"; clientId: string; undone: boolean }
  | { name: "checkin"; beneficiary: Beneficiary; clientId?: string; people: number; alreadyAt?: string; undone: boolean };

const IDLE_MS = 60_000;

export default function Kiosk({ centreName }: { centreName: string }) {
  const kiosk = useKiosk();
  const [screen, setScreen] = useState<Screen>({ name: "painel" });
  const lastTouch = useRef(0);

  const home = useCallback(() => setScreen({ name: "painel" }), []);

  // Back to the dashboard after 60 s without a touch.
  useEffect(() => {
    lastTouch.current = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - lastTouch.current > IDLE_MS) setScreen((s) => (s.name === "painel" ? s : { name: "painel" }));
    }, 5_000);
    return () => clearInterval(timer);
  }, []);

  const recordUnregistered = async () => {
    const result = await kiosk.record("nao_inscrito");
    if (result.status === "ok") setScreen({ name: "obrigado", clientId: result.clientId, undone: false });
  };

  const checkIn = async (b: Beneficiary) => {
    const result = await kiosk.record("inscrito", b);
    if (result.status === "already") {
      setScreen({ name: "checkin", beneficiary: b, people: b.adults + b.children, alreadyAt: result.at, undone: false });
    } else {
      setScreen({ name: "checkin", beneficiary: b, clientId: result.clientId, people: result.people, undone: false });
    }
  };

  return (
    <Stage>
      <div className="h-full w-full" onPointerDown={() => (lastTouch.current = Date.now())}>
        {screen.name === "painel" && (
          <Painel centreName={centreName} today={kiosk.counts.today} week={kiosk.counts.week} onRecord={() => setScreen({ name: "tipo" })} />
        )}
        {screen.name === "tipo" && (
          <Tipo onBack={home} onUnregistered={recordUnregistered} onRegistered={() => setScreen({ name: "lista" })} />
        )}
        {screen.name === "lista" && (
          <Lista beneficiaries={kiosk.beneficiaries} onBack={() => setScreen({ name: "tipo" })} onCheckIn={checkIn} />
        )}
        {screen.name === "obrigado" && (
          <Obrigado
            undone={screen.undone}
            onRecord={() => setScreen({ name: "tipo" })}
            onUndo={() => {
              void kiosk.undo(screen.clientId, 1);
              setScreen({ ...screen, undone: true });
            }}
            onDone={home}
          />
        )}
        {screen.name === "checkin" && (
          <CheckIn
            key={screen.beneficiary.id + (screen.clientId ?? "")}
            screen={screen}
            onRecord={() => setScreen({ name: "tipo" })}
            onUndo={() => {
              if (screen.clientId) void kiosk.undo(screen.clientId, screen.people, screen.beneficiary.id);
              setScreen({ ...screen, undone: true });
            }}
            onDone={home}
          />
        )}
        {!kiosk.online && <OfflineBadge />}
      </div>
    </Stage>
  );
}

/* ------------------------------------------------------------------ */
/* 1.1 Painel                                                          */
/* ------------------------------------------------------------------ */

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(new Date()), 0);
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  return now;
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Painel({ centreName, today, week, onRecord }: { centreName: string; today: number; week: number; onRecord: () => void }) {
  const now = useClock();
  const pt = now ? capitalise(new Intl.DateTimeFormat("pt-PT", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(now)) : "";
  const en = now ? new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(now) : "";
  return (
    <div className="flex h-full flex-col gap-[32px] px-[56px] py-[40px]">
      <div className="flex h-[64px] items-center justify-between">
        <div className="flex items-center gap-[16px]">
          <div className="flex h-[60px] w-[60px] items-center justify-center rounded-[20px] bg-leaf text-white">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 20c0-9 6-15 15-15 0 9-6 15-15 15z" />
              <path d="M5 20l8-8" />
            </svg>
          </div>
          <Bi pt="Refood" en={centreName ? `Núcleo ${centreName}` : "Quiosque de beneficiários"} ptClass="text-[28px] font-black" enClass="text-[18px] text-muted" />
        </div>
        <Bi pt={pt} en={en} align="end" ptClass="text-[26px] font-extrabold" enClass="text-[18px] text-muted" />
      </div>

      <div className="grid flex-1 grid-cols-2 gap-[32px]">
        <div className="flex flex-col justify-between rounded-[36px] border-2 border-line bg-white px-[52px] py-[44px]">
          <Bi pt="Hoje ajudámos" en="Today we helped" ptClass="text-[40px] font-extrabold" enClass="text-[22px] text-muted" />
          <div className="text-[200px] font-black leading-none tracking-[-4px]">{today}</div>
          <Bi pt="pessoas" en="people" ptClass="text-[36px] font-extrabold text-leaf-link" enClass="text-[20px] text-muted" />
        </div>
        <div className="flex flex-col justify-between rounded-[36px] bg-peach px-[52px] py-[44px]">
          <Bi pt="Esta semana ajudámos" en="This week we helped" ptClass="text-[40px] font-extrabold" enClass="text-[22px] text-clay-text" />
          <div className="text-[200px] font-black leading-none tracking-[-4px]">{week}</div>
          <Bi pt="pessoas" en="people" ptClass="text-[36px] font-extrabold text-clay" enClass="text-[20px] text-clay-text" />
        </div>
      </div>

      <RecordButton big onClick={onRecord} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1.2 Tipo de atendimento                                             */
/* ------------------------------------------------------------------ */

function Tipo({ onBack, onUnregistered, onRegistered }: { onBack: () => void; onUnregistered: () => void; onRegistered: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex h-full flex-col gap-[36px] px-[56px] pb-[56px] pt-[40px]">
      <div className="flex items-center gap-[40px]">
        <BackButton onClick={onBack} />
        <Bi pt={<h1 className="text-[48px] font-black">Que tipo de atendimento?</h1>} en="What type of visit?" enClass="text-[26px] text-muted" />
      </div>
      <div className="grid flex-1 grid-cols-2 gap-[40px]">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            onUnregistered();
          }}
          className="tap flex flex-col items-center justify-center gap-[40px] rounded-[40px] border-[3px] border-leaf-line bg-white shadow-[0_6px_0_#cfe3d6]"
        >
          <span className="flex h-[260px] w-[260px] items-center justify-center rounded-full bg-leaf-soft text-leaf">
            <svg width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="7" r="4" />
              <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
            </svg>
          </span>
          <Bi pt="Não inscrito" en="Not registered" align="center" ptClass="text-[52px] font-black" enClass="text-[28px] text-muted" />
        </button>
        <button
          type="button"
          onClick={onRegistered}
          className="tap flex flex-col items-center justify-center gap-[40px] rounded-[40px] border-[3px] border-leaf-line bg-white shadow-[0_6px_0_#cfe3d6]"
        >
          <span className="flex h-[260px] w-[260px] items-center justify-center rounded-full bg-peach text-[#a8551a]">
            <svg width="160" height="160" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="7" cy="7" r="3" />
              <circle cx="17" cy="7" r="3" />
              <circle cx="12" cy="13.5" r="2.3" />
              <path d="M1.5 20v-1a4 4 0 0 1 4-4h2.5" />
              <path d="M22.5 20v-1a4 4 0 0 0-4-4H16" />
              <path d="M8.5 21v-.5a3.5 3.5 0 0 1 7 0v.5" />
            </svg>
          </span>
          <Bi pt="Inscrito" en="Registered" align="center" ptClass="text-[52px] font-black" enClass="text-[28px] text-muted" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1.3 Procurar beneficiário                                           */
/* ------------------------------------------------------------------ */

const GROUPS = [
  ["A–C", "abc"],
  ["D–F", "def"],
  ["G–I", "ghi"],
  ["J–L", "jkl"],
  ["M–O", "mno"],
  ["P–R", "pqr"],
  ["S–U", "stu"],
  ["V–Z", "vwxyz"],
] as const;

function Lista({
  beneficiaries,
  onBack,
  onCheckIn,
}: {
  beneficiaries: Beneficiary[];
  onBack: () => void;
  onCheckIn: (b: Beneficiary) => void;
}) {
  const [q, setQ] = useState("");
  const [keyboard, setKeyboard] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(() => [...beneficiaries].sort((a, b) => a.name.localeCompare(b.name, "pt")), [beneficiaries]);
  const list = useMemo(() => {
    const needle = fold(q.trim());
    if (!needle) return sorted;
    return sorted.filter((b) => fold(b.name).includes(needle) || padNumber(b.number).includes(needle) || String(b.number) === needle);
  }, [q, sorted]);

  const jump = (letters: string) => {
    const container = listRef.current;
    if (!container) return;
    const target = list.find((b) => letters.includes(fold(b.name).charAt(0))) ??
      list.find((b) => fold(b.name).charAt(0) > letters.charAt(letters.length - 1));
    if (!target) return;
    const el = container.querySelector<HTMLElement>(`[data-id="${target.id}"]`);
    if (el) container.scrollTo({ top: el.offsetTop - container.offsetTop, behavior: "smooth" });
  };

  return (
    <div className="relative flex h-full flex-col gap-[20px] px-[48px] pt-[32px]">
      <div className="flex shrink-0 items-center gap-[32px]">
        <BackButton onClick={onBack} />
        <Bi pt={<h1 className="text-[44px] font-black">Procurar beneficiário</h1>} en="Find beneficiary" enClass="text-[24px] text-muted" />
        <span className="ml-auto">
          <Bi
            pt={`${list.length} ${list.length === 1 ? "beneficiário" : "beneficiários"}`}
            en="por ordem alfabética · A–Z"
            align="end"
            ptClass="text-[22px] font-extrabold"
            enClass="text-[15px] text-muted"
          />
        </span>
      </div>

      <div
        className={`flex h-[96px] shrink-0 items-center gap-[16px] rounded-[28px] bg-white pl-[28px] pr-[12px] ${
          keyboard ? "border-[3px] border-leaf" : "border-2 border-line-strong"
        }`}
      >
        <button
          type="button"
          onClick={() => setKeyboard(true)}
          aria-label="Procurar por nome ou número / Search by name or number"
          className="flex h-full flex-1 items-center gap-[20px] text-left text-ink"
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#5E6B62" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          {q ? (
            <span className="text-[40px] font-black tracking-[1px]">
              {q}
              {keyboard && <span className="ml-[4px] inline-block h-[40px] w-[3px] translate-y-[6px] bg-leaf" />}
            </span>
          ) : (
            <Bi pt="Procurar por nome ou número" en="Search by name or number" ptClass="text-[30px] font-extrabold text-muted" enClass="text-[17px] text-muted" />
          )}
        </button>
        {q && (
          <button type="button" onClick={() => setQ("")} className="tap flex h-[72px] items-center gap-[8px] rounded-[18px] bg-sand px-[22px] text-[22px] font-extrabold">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            Limpar
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 gap-[20px]">
        <div
          ref={listRef}
          className="kiosk-scroll relative flex flex-1 flex-col gap-[12px] overflow-y-auto pr-[8px]"
          style={{ paddingBottom: keyboard ? 420 : 32 }}
        >
          {list.map((b) => (
            <div
              key={b.id}
              data-id={b.id}
              className="flex min-h-[108px] shrink-0 items-center gap-[24px] rounded-[28px] border-2 border-line bg-white py-[12px] pl-[24px] pr-[14px]"
            >
              <span className="flex w-[150px] shrink-0 flex-col leading-[1.05]">
                <span className="text-[15px] font-extrabold text-muted">N.º</span>
                <span className="text-[40px] font-black">{padNumber(b.number)}</span>
              </span>
              <span className="flex-1 text-[36px] font-extrabold">{b.name}</span>
              <button
                type="button"
                onClick={() => onCheckIn(b)}
                className="tap flex h-[84px] w-[250px] items-center justify-center gap-[14px] rounded-[24px] bg-leaf text-white shadow-[0_4px_0_#1e5a38]"
              >
                <CheckIcon size={34} />
                <Bi pt="Check-in" en="Check in" ptClass="text-[30px] font-black" enClass="text-[16px] text-leaf-mist" />
              </button>
            </div>
          ))}
          {list.length === 0 && (
            <div className="flex flex-col items-center rounded-[28px] border-2 border-dashed border-line-strong bg-white p-[40px] text-center">
              <Bi
                pt={beneficiaries.length === 0 ? "Ainda não há beneficiários inscritos" : "Nenhum beneficiário encontrado"}
                en={beneficiaries.length === 0 ? "No registered beneficiaries yet" : "No beneficiary found"}
                align="center"
                ptClass="text-[32px] font-black"
                enClass="text-[19px] text-muted"
              />
            </div>
          )}
        </div>
        {!keyboard && (
          <nav aria-label="Saltar para a letra" className="flex w-[120px] shrink-0 flex-col gap-[10px] pb-[32px]">
            {GROUPS.map(([label, letters]) => (
              <button
                key={label}
                type="button"
                onClick={() => jump(letters)}
                className="tap min-h-0 flex-1 rounded-[20px] border-2 border-leaf-line bg-white text-[24px] font-black"
              >
                {label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {keyboard && <Keyboard value={q} onChange={setQ} onClose={() => setKeyboard(false)} />}
    </div>
  );
}

function Keyboard({ value, onChange, onClose }: { value: string; onChange: (v: string) => void; onClose: () => void }) {
  const [mode, setMode] = useState<"abc" | "123">("abc");
  const key = "tap h-[80px] rounded-[16px] border-2 border-line bg-white font-black text-ink";
  const letter = (c: string) => (
    <button key={c} type="button" onClick={() => onChange(value + c)} className={`${key} w-[108px] text-[32px]`}>
      {c}
    </button>
  );
  const special = (label: string, onClick: () => void, extra = "", width = 200) => (
    <button key={label} type="button" onClick={onClick} className={`${key} text-[22px] ${extra}`} style={{ width }}>
      {label}
    </button>
  );
  const erase = special("⌫ Apagar", () => onChange(value.slice(0, -1)), "bg-line");
  const close = special("Fechar", onClose, "!bg-leaf !text-white !border-leaf");
  const rows =
    mode === "abc"
      ? [
          "QWERTYUIOP".split("").map(letter),
          "ASDFGHJKLÇ".split("").map(letter),
          [...("ZXCVBNM".split("").map(letter)), erase],
          [special("123", () => setMode("123")), special("Espaço", () => onChange(value + " "), "", 560), close],
        ]
      : [["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map(letter), [special("ABC", () => setMode("abc")), erase, close]];
  return (
    <div role="group" aria-label="Teclado" className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-[10px] border-t-2 border-line bg-sand px-[48px] pb-[22px] pt-[18px]">
      {rows.map((row, i) => (
        <div key={i} className="flex justify-center gap-[10px]">
          {row}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1.4 Check-in do beneficiário                                        */
/* ------------------------------------------------------------------ */

function CheckIn({
  screen,
  onRecord,
  onUndo,
  onDone,
}: {
  screen: Extract<Screen, { name: "checkin" }>;
  onRecord: () => void;
  onUndo: () => void;
  onDone: () => void;
}) {
  const b = screen.beneficiary;
  const already = !!screen.alreadyAt;
  return (
    <div className="relative flex h-full flex-col gap-[24px] px-[56px] pt-[36px]">
      {already ? (
        <div role="alert" className="flex h-[84px] items-center gap-[18px] rounded-[24px] bg-alert px-[28px] text-white">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3l10 18H2z" />
            <path d="M12 10v5M12 18v.5" />
          </svg>
          <Bi
            pt="Este beneficiário já foi atendido hoje."
            en={`This beneficiary was already served today. · Atendido às ${lisbonTime(screen.alreadyAt!)} · nada foi registado`}
            ptClass="text-[32px] font-black"
            enClass="text-[18px] text-alert-soft"
          />
        </div>
      ) : screen.undone ? (
        <div role="status" className="flex h-[84px] items-center gap-[18px] rounded-[24px] bg-sand px-[28px] text-quiet">
          <UndoIcon size={40} />
          <Bi pt="Registo anulado" en="Entry undone" ptClass="text-[32px] font-black" enClass="text-[18px] text-muted" />
        </div>
      ) : (
        <div role="status" className="flex h-[84px] items-center gap-[18px] rounded-[24px] bg-leaf-soft px-[28px] text-leaf-deep">
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-leaf text-white">
            <CheckIcon />
          </span>
          <Bi
            pt={`Atendimento registado · ${screen.people} ${screen.people === 1 ? "pessoa" : "pessoas"}`}
            en={`Visit recorded · ${screen.people} ${screen.people === 1 ? "person" : "people"}`}
            ptClass="text-[32px] font-black"
            enClass="text-[18px] text-[#2e5e40]"
          />
        </div>
      )}

      <div className="flex items-center gap-[28px]">
        <span className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-peach text-[48px] font-black text-clay">{initials(b.name)}</span>
        <span className="flex flex-col leading-none">
          <span className="text-[80px] font-black tracking-[-1px]">{b.name}</span>
          <span className="mt-[10px] text-[26px] font-bold text-muted">
            N.º {padNumber(b.number)} · {BENEFICIARY_TYPE_LABEL[b.type]}
          </span>
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[260px_260px_minmax(0,1fr)] gap-[24px]">
        <div className="flex flex-col justify-between rounded-[32px] border-2 border-line bg-white p-[28px]">
          <Bi pt="Adultos" en="Adults" ptClass="text-[32px] font-extrabold" enClass="text-[18px] text-muted" />
          <span className="text-[150px] font-black leading-none">{b.adults}</span>
        </div>
        <div className="flex flex-col justify-between rounded-[32px] border-2 border-line bg-white p-[28px]">
          <Bi pt="Crianças" en="Children" ptClass="text-[32px] font-extrabold" enClass="text-[18px] text-muted" />
          <span className="text-[150px] font-black leading-none">{b.children}</span>
        </div>
        <div className="flex flex-col gap-[18px] overflow-hidden rounded-[32px] bg-peach px-[32px] py-[28px]">
          <span className="flex items-center gap-[14px]">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8A4A12" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1-3 4-3 7s1 4 3 4" />
            </svg>
            <Bi pt="Alimentação" en="Food requirements" ptClass="text-[32px] font-extrabold" enClass="text-[18px] text-clay-text" />
          </span>
          {b.foodNeeds.length > 0 ? (
            <div className="flex flex-wrap gap-[12px]">
              {b.foodNeeds.map((d) => (
                <span key={d} className="rounded-[18px] bg-white px-[20px] py-[12px] text-[28px] font-black">
                  {d}
                </span>
              ))}
            </div>
          ) : (
            !b.foodNotes && (
              <Bi pt="Sem indicações" en="No special requirements" ptClass="text-[28px] font-extrabold text-clay-text" enClass="text-[17px] text-clay-text" />
            )
          )}
          {b.foodNotes && <span className="text-[24px] font-bold leading-[1.3] text-[#3f2a16]">{b.foodNotes}</span>}
        </div>
      </div>

      <div className="flex items-center gap-[24px] pb-[60px]">
        <div className="flex-1 [&>button]:w-full">
          <RecordButton onClick={onRecord} />
        </div>
        {!already && !screen.undone && <UndoButton onClick={onUndo} />}
      </div>

      <Countdown seconds={45} onDone={onDone} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1.5 Obrigado (não inscrito)                                         */
/* ------------------------------------------------------------------ */

function Obrigado({ undone, onRecord, onUndo, onDone }: { undone: boolean; onRecord: () => void; onUndo: () => void; onDone: () => void }) {
  return (
    <div className="relative flex h-full flex-col items-center px-[56px] pt-[56px]">
      {!undone ? (
        <div className="flex w-full flex-1 flex-col items-center justify-center gap-[28px] pb-[56px]">
          <div className="pop flex h-[200px] w-[200px] items-center justify-center rounded-full bg-leaf text-white shadow-[0_0_0_24px_#e4f1e8]">
            <CheckIcon size={120} />
          </div>
          <span className="mt-[12px]">
            <Bi pt={<h1 className="text-[96px] font-black leading-[1.05]">Obrigado!</h1>} en="Thank you!" align="center" enClass="text-[40px] text-muted" />
          </span>
          <div className="rounded-[22px] border-2 border-line bg-white px-[32px] py-[16px]">
            <Bi pt="Não inscrito · 1 pessoa" en="Not registered · 1 person" align="center" ptClass="text-[32px] font-extrabold" enClass="text-[19px] text-muted" />
          </div>
          <div className="mt-[8px] flex items-center gap-[28px]">
            <RecordButton onClick={onRecord} />
            <UndoButton onClick={onUndo} />
          </div>
        </div>
      ) : (
        <div className="flex w-full flex-1 flex-col items-center justify-center gap-[36px] pb-[56px]">
          <div className="flex h-[200px] w-[200px] items-center justify-center rounded-full bg-sand text-muted">
            <UndoIcon size={110} />
          </div>
          <Bi pt={<h1 className="text-[80px] font-black">Registo anulado</h1>} en="Entry undone" align="center" enClass="text-[36px] text-muted" />
          <RecordButton onClick={onRecord} />
        </div>
      )}
      <Countdown key={String(undone)} seconds={5} onDone={onDone} />
    </div>
  );
}
