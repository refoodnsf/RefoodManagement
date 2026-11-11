"use client";

import { useState, useTransition } from "react";
import { deleteEvent } from "./actions";

/** Two-step delete: first tap asks, second tap deletes. */
export default function DeleteButton({ id }: { id: string }) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="h-[34px] rounded-lg border border-[#e8b4ac] bg-white px-3 text-[13px] font-extrabold text-danger hover:bg-alert-soft"
      >
        Apagar
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => deleteEvent(id))}
        className="h-[34px] rounded-lg bg-danger px-3 text-[13px] font-extrabold text-white disabled:opacity-60"
      >
        {pending ? "A apagar…" : "Confirmar"}
      </button>
      <button type="button" onClick={() => setAsking(false)} className="h-[34px] rounded-lg border border-line-strong bg-white px-3 text-[13px] font-extrabold">
        Cancelar
      </button>
    </span>
  );
}
