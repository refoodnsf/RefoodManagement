import type { ButtonHTMLAttributes, ReactNode } from "react";

export function LeafMark({ size = 40 }: { size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-[13px] bg-leaf text-white" style={{ width: size, height: size }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 20c0-9 6-15 15-15 0 9-6 15-15 15z" />
        <path d="M5 20l8-8" />
      </svg>
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-extrabold">
      <span>
        {label}
        {hint && <span className="ml-1 font-semibold text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function PrimaryButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-leaf px-4 text-sm font-extrabold text-white hover:bg-leaf-dark disabled:opacity-60 ${className}`}
    />
  );
}

export function SecondaryButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-line-strong bg-white px-4 text-sm font-extrabold text-ink hover:bg-ground disabled:opacity-60 ${className}`}
    />
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="mr-auto flex flex-col">
        <h1 className="text-[28px] font-black">{title}</h1>
        {subtitle && <span className="text-sm font-semibold text-muted">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-white ${className}`}>{children}</section>;
}

export function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Centred dialog over a dimmed page. Close handling is up to the caller. */
export function Modal({ title, onClose, children, wide = false }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(31,42,34,.45)] p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full flex-col gap-4 overflow-y-auto rounded-[20px] bg-white p-7 shadow-[0_24px_60px_rgba(0,0,0,.2)] ${wide ? "max-w-[860px]" : "max-w-[520px]"}`}
      >
        <h2 className="text-[22px] font-black">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-[10px] bg-alert-soft px-3 py-2 text-sm font-bold text-danger">
      {children}
    </p>
  );
}

export function OkNote({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-[10px] bg-leaf-soft px-3 py-2 text-sm font-bold text-leaf-deep">
      {children}
    </p>
  );
}

export function Chip({ tone, children }: { tone: "green" | "grey" | "peach" | "red"; children: ReactNode }) {
  const c = { green: "bg-leaf-soft text-leaf-deep", grey: "bg-sand text-muted", peach: "bg-peach text-clay", red: "bg-alert text-white" }[tone];
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-extrabold ${c}`}>{children}</span>;
}

export const linkButton =
  "inline-flex h-10 items-center gap-2 rounded-[10px] border border-line-strong bg-white px-3.5 text-sm font-extrabold hover:bg-ground";
export const primaryLink = "inline-flex h-10 items-center gap-2 rounded-[10px] bg-leaf px-4 text-sm font-extrabold text-white hover:bg-leaf-dark";
