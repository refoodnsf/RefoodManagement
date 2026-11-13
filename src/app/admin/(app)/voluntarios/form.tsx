"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ErrorNote, Field, PrimaryButton } from "../../ui";
import type { VolunteerFormState } from "./actions";

export default function VolunteerForm({
  action,
  initial,
}: {
  action: (prev: VolunteerFormState, form: FormData) => Promise<VolunteerFormState>;
  initial: { number: number; name: string; phone: string; email: string; active: boolean };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex w-full max-w-[560px] flex-col gap-4 rounded-[20px] border border-line bg-white p-7">
      <div className="flex items-center gap-3">
        <h2 className="mr-auto text-[20px] font-black">Dados do voluntário</h2>
        <span className="rounded-[10px] bg-leaf-soft px-3 py-1.5 text-sm font-black text-leaf-deep">N.º {initial.number}</span>
      </div>
      <Field label="Nome">
        <input name="name" required maxLength={120} defaultValue={initial.name} className="input" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Telefone" hint="(opcional)">
          <input name="phone" type="tel" maxLength={40} defaultValue={initial.phone} className="input" />
        </Field>
        <Field label="Email" hint="(opcional)">
          <input name="email" type="email" maxLength={120} defaultValue={initial.email} className="input" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm font-extrabold">
        <input type="checkbox" name="active" defaultChecked={initial.active} className="h-4 w-4 accent-leaf" />
        Ativo
        <span className="font-semibold text-muted">— um voluntário inativo não consegue fazer a entrada; o número não é reutilizado</span>
      </label>
      {state.error && <ErrorNote>{state.error}</ErrorNote>}
      <div className="flex justify-end gap-2.5">
        <Link href="/admin/voluntarios" className="inline-flex h-10 items-center rounded-[10px] border border-line-strong bg-white px-4 text-sm font-extrabold hover:bg-ground">
          Cancelar
        </Link>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "A guardar…" : "Guardar"}
        </PrimaryButton>
      </div>
    </form>
  );
}
