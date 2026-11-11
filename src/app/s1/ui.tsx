"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export const STAGE_W = 1368;
export const STAGE_H = 912;

/** Renders the 1368×912 design canvas scaled to fill any screen. */
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div className="kiosk fixed inset-0 flex items-center justify-center overflow-hidden bg-ground">
      <div
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: "center" }}
        className="relative shrink-0 bg-ground text-ink"
      >
        {children}
      </div>
    </div>
  );
}

/** Portuguese on top, English smaller below. */
export function Bi({
  pt,
  en,
  ptClass = "",
  enClass = "",
  align = "start",
}: {
  pt: ReactNode;
  en: ReactNode;
  ptClass?: string;
  enClass?: string;
  align?: "start" | "center" | "end";
}) {
  const items = align === "center" ? "items-center text-center" : align === "end" ? "items-end text-right" : "items-start";
  return (
    <span className={`flex flex-col leading-[1.1] ${items}`}>
      <span className={ptClass}>{pt}</span>
      <span className={`font-semibold ${enClass}`}>{en}</span>
    </span>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap flex h-[88px] shrink-0 items-center gap-[14px] rounded-[24px] border-2 border-line bg-white pl-[22px] pr-[34px] text-ink"
    >
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      <Bi pt="Voltar" en="Back" ptClass="text-[30px] font-extrabold" enClass="text-[17px] text-muted" />
    </button>
  );
}

export function PlusIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function UndoIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}

export function CheckIcon({ size = 32, stroke = 3 }: { size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function RecordButton({ onClick, big = false }: { onClick: () => void; big?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap flex items-center justify-center rounded-[32px] bg-leaf text-white shadow-[0_6px_0_#1e5a38] ${
        big ? "h-[168px] w-full gap-[32px] rounded-[36px]" : "h-[120px] gap-[22px] px-[48px]"
      }`}
    >
      {big ? (
        <span className="flex h-[96px] w-[96px] items-center justify-center rounded-full bg-white/20">
          <PlusIcon size={56} />
        </span>
      ) : (
        <PlusIcon />
      )}
      <Bi
        pt="Registar atendimento"
        en="Record new beneficiary"
        ptClass={big ? "text-[52px] font-black" : "text-[38px] font-black"}
        enClass={big ? "text-[28px] text-leaf-mist" : "text-[21px] text-leaf-mist"}
      />
    </button>
  );
}

export function UndoButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap flex h-[96px] items-center gap-[12px] rounded-[26px] border-2 border-line-strong bg-transparent px-[30px] text-ink"
    >
      <UndoIcon />
      <Bi pt="Anular" en="Undo" ptClass="text-[26px] font-extrabold" enClass="text-[15px] text-muted" />
    </button>
  );
}

/** Countdown bar along the bottom edge; calls onDone when time runs out. */
/** Restart it by changing its React `key`. */
export function Countdown({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [left, setLeft] = useState(seconds);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      const remaining = Math.max(0, seconds - (Date.now() - started) / 1000);
      setLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        done.current();
      }
    }, 200);
    return () => clearInterval(timer);
  }, [seconds]);
  return (
    <button
      type="button"
      onClick={() => done.current()}
      aria-label="Voltar ao painel"
      className="absolute inset-x-0 bottom-0 flex h-[56px] flex-col justify-end"
    >
      <span className="absolute bottom-[26px] right-[32px] text-[16px] font-bold text-muted">{Math.ceil(left)} s</span>
      <span
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={seconds}
        aria-valuenow={Math.ceil(left)}
        className="block h-[14px] w-full bg-line"
      >
        <span
          className="block h-[14px] rounded-r-[7px] bg-orange transition-[width] duration-200 ease-linear"
          style={{ width: `${(left / seconds) * 100}%` }}
        />
      </span>
    </button>
  );
}

export function OfflineBadge() {
  return (
    <div role="status" className="absolute right-[24px] top-[116px] z-10 flex items-center gap-[10px] rounded-[18px] bg-peach px-[18px] py-[10px] text-clay">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
        <path d="M2 2l20 20" />
        <path d="M8.5 16.5a5 5 0 0 1 7 0" />
        <path d="M5 13a10 10 0 0 1 5-2.8" />
        <path d="M2 8.8a15 15 0 0 1 4-2.6" />
        <path d="M22 8.8A15 15 0 0 0 11 5" />
        <path d="M19 13a10 10 0 0 0-2.2-1.6" />
      </svg>
      <Bi pt="Sem ligação — a guardar localmente" en="Offline — saving locally" ptClass="text-[16px] font-extrabold" enClass="text-[13px]" />
    </div>
  );
}
