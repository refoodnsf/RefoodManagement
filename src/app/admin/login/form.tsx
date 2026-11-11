"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";
import { Field, PrimaryButton } from "../ui";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Email">
        <input name="email" type="email" autoComplete="email" required defaultValue={state.email} className="input" />
      </Field>
      <Field label="Palavra-passe">
        <input name="password" type="password" autoComplete="current-password" required className="input" />
      </Field>
      {state.error && (
        <p role="alert" className="rounded-[10px] bg-alert-soft px-3 py-2 text-sm font-bold text-danger">
          {state.error}
        </p>
      )}
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "A entrar…" : "Entrar"}
      </PrimaryButton>
    </form>
  );
}
