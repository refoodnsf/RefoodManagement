"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FOOD_OPTIONS, padNumber } from "@/lib/domain";
import { Field, PrimaryButton } from "../../ui";
import type { BeneficiaryFormState } from "./actions";

export type BeneficiaryValues = {
  number?: number;
  name: string;
  type: "familia" | "individual";
  adults: number;
  children: number;
  food_needs: string[];
  food_notes: string;
  active: boolean;
};

export default function BeneficiaryForm({
  action,
  initial,
}: {
  action: (prev: BeneficiaryFormState, form: FormData) => Promise<BeneficiaryFormState>;
  initial: BeneficiaryValues;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [needs, setNeeds] = useState<string[]>(initial.food_needs);
  const editing = initial.number !== undefined;

  return (
    <form action={formAction} className="flex max-w-[680px] flex-col gap-5 rounded-[20px] border border-line bg-white p-7">
      <div className="flex items-center gap-3">
        <h2 className="mr-auto text-[22px] font-black">Ficha do beneficiário</h2>
        <span className="rounded-[10px] bg-leaf-soft px-3 py-1.5 text-sm font-black text-leaf-deep">
          {editing ? `N.º ${padNumber(initial.number!)}` : "N.º automático"}
        </span>
      </div>

      <Field label="Nome">
        <input name="name" required maxLength={120} defaultValue={initial.name} className="input" autoFocus={!editing} />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Tipo de beneficiário">
          <select name="type" defaultValue={initial.type} className="input">
            <option value="familia">Família</option>
            <option value="individual">Individual</option>
          </select>
        </Field>
        <Field label="Número de adultos">
          <input name="adults" type="number" min={0} max={30} required defaultValue={initial.adults} className="input" />
        </Field>
        <Field label="Número de crianças">
          <input name="children" type="number" min={0} max={30} required defaultValue={initial.children} className="input" />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-extrabold">Detalhes de alimentação</legend>
        <div className="flex flex-wrap gap-2">
          {FOOD_OPTIONS.map((label) => {
            const on = needs.includes(label);
            return (
              <label
                key={label}
                className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-extrabold ${
                  on ? "border border-peach-line bg-peach text-clay" : "border border-line-strong bg-white text-quiet"
                }`}
              >
                <input
                  type="checkbox"
                  name="food_needs"
                  value={label}
                  checked={on}
                  onChange={(e) => setNeeds((n) => (e.target.checked ? [...n, label] : n.filter((x) => x !== label)))}
                  className="accent-leaf"
                />
                {label}
              </label>
            );
          })}
        </div>
        <Field label="Notas para a equipa" hint="(aparecem no quiosque)">
          <textarea name="food_notes" rows={2} maxLength={500} defaultValue={initial.food_notes} className="input" />
        </Field>
      </fieldset>

      {editing && (
        <label className="flex items-center gap-2 text-sm font-extrabold">
          <input type="checkbox" name="active" defaultChecked={initial.active} className="h-4 w-4 accent-leaf" />
          Ativo
          <span className="font-semibold text-muted">— desmarque para deixar de aparecer no quiosque</span>
        </label>
      )}

      <p className="text-xs font-bold text-muted">
        O nome, o número, o agregado e os detalhes de alimentação aparecem no quiosque de beneficiários durante o check-in.
      </p>

      {state.error && (
        <p role="alert" className="rounded-[10px] bg-alert-soft px-3 py-2 text-sm font-bold text-danger">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2.5">
        <Link href="/admin/beneficiarios" className="inline-flex h-10 items-center rounded-[10px] border border-line-strong bg-white px-4 text-sm font-extrabold hover:bg-ground">
          Cancelar
        </Link>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "A guardar…" : "Guardar"}
        </PrimaryButton>
      </div>
    </form>
  );
}
