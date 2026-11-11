"use client";

import { useActionState, useState, useTransition } from "react";
import { Field, PrimaryButton, SecondaryButton } from "../../ui";
import { createUser, removeUser, resetPassword, type UserActionState } from "./actions";

function PasswordNotice({ email, password }: { email?: string; password: string }) {
  return (
    <div role="status" className="rounded-xl border border-peach-line bg-peach p-3 text-sm font-bold text-clay">
      {email ? <>Conta criada para {email}. </> : null}
      Palavra-passe temporária: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-ink select-all">{password}</code>
      <br />
      <span className="font-semibold">Envie-a à pessoa por um canal privado. Não volta a ser mostrada; ela deve mudá-la em “A minha conta”.</span>
    </div>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState<UserActionState, FormData>(createUser, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome">
          <input name="name" className="input" maxLength={80} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" required className="input" placeholder="nome@exemplo.pt" />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-extrabold">Perfil</legend>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line-strong p-3 has-[:checked]:border-2 has-[:checked]:border-leaf has-[:checked]:bg-[#f4faf6]">
          <input type="radio" name="role" value="administrador" className="mt-1 accent-leaf" />
          <span className="flex flex-col">
            <span className="text-sm font-extrabold">Administrador</span>
            <span className="text-[13px] font-semibold text-muted">Acesso a tudo.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line-strong p-3 has-[:checked]:border-2 has-[:checked]:border-leaf has-[:checked]:bg-[#f4faf6]">
          <input type="radio" name="role" value="gestor_beneficiarios" defaultChecked className="mt-1 accent-leaf" />
          <span className="flex flex-col">
            <span className="text-sm font-extrabold">Gestor Beneficiários</span>
            <span className="text-[13px] font-semibold text-muted">Só a página de beneficiários.</span>
          </span>
        </label>
      </fieldset>
      {state.error && <p role="alert" className="rounded-[10px] bg-alert-soft px-3 py-2 text-sm font-bold text-danger">{state.error}</p>}
      {state.password && <PasswordNotice email={state.email} password={state.password} />}
      <div className="flex justify-end">
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "A criar…" : "Criar utilizador"}
        </PrimaryButton>
      </div>
    </form>
  );
}

export function RowActions({ userId, self }: { userId: string; self: boolean }) {
  const [pending, start] = useTransition();
  const [password, setPassword] = useState<string>();
  const [error, setError] = useState<string>();
  const [confirmRemove, setConfirmRemove] = useState(false);
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1.5">
        <SecondaryButton
          type="button"
          className="!h-[34px] !px-3 !text-[13px]"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await resetPassword(userId);
              setPassword(r.password);
              setError(r.error);
            })
          }
        >
          Nova palavra-passe
        </SecondaryButton>
        {!self &&
          (confirmRemove ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => start(() => removeUser(userId))}
              className="h-[34px] rounded-lg bg-danger px-3 text-[13px] font-extrabold text-white"
            >
              Confirmar remoção
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="h-[34px] rounded-lg border border-[#e8b4ac] bg-white px-3 text-[13px] font-extrabold text-danger"
            >
              Remover
            </button>
          ))}
      </div>
      {password && <PasswordNotice password={password} />}
      {error && <p className="text-xs font-bold text-danger">{error}</p>}
    </div>
  );
}
