"use client";

import { useActionState } from "react";
import { Field, PrimaryButton } from "../../ui";
import { changePassword, type PasswordState } from "./actions";

export default function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Nova palavra-passe" hint="(mínimo 10 caracteres)">
        <input name="password" type="password" autoComplete="new-password" minLength={10} required className="input" />
      </Field>
      <Field label="Repetir nova palavra-passe">
        <input name="confirm" type="password" autoComplete="new-password" minLength={10} required className="input" />
      </Field>
      {state.error && <p role="alert" className="rounded-[10px] bg-alert-soft px-3 py-2 text-sm font-bold text-danger">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-[10px] bg-leaf-soft px-3 py-2 text-sm font-bold text-leaf-deep">Palavra-passe mudada.</p>}
      <PrimaryButton type="submit" disabled={pending} className="self-end">
        {pending ? "A guardar…" : "Guardar"}
      </PrimaryButton>
    </form>
  );
}
