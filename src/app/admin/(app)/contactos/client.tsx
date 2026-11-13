"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { KioskContact } from "@/lib/s2";
import { ErrorNote, Field, Modal, PlusIcon, PrimaryButton, SecondaryButton } from "../../ui";
import { deleteContact, reorderContacts, saveContact } from "./actions";

export default function Contacts({ contacts }: { contacts: KioskContact[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<KioskContact | "new" | null>(null);
  const [pending, start] = useTransition();

  const move = (i: number, delta: number) => {
    const ids = contacts.map((c) => c.id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    start(async () => {
      await reorderContacts(ids);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-3">
        <div className="flex justify-end">
          <PrimaryButton type="button" onClick={() => setEditing("new")}>
            <PlusIcon />
            Adicionar contacto
          </PrimaryButton>
        </div>
        <ol className={`flex flex-col gap-2 ${pending ? "opacity-60" : ""}`}>
          {contacts.map((c, i) => (
            <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3">
              <span className="w-5 text-right text-[13px] font-black text-muted">{i + 1}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-black">{c.name}</span>
                <span className="text-xs font-bold text-muted">{c.note || "—"}</span>
              </span>
              <span className="text-[18px] font-black text-danger">{c.phone}</span>
              <span className="flex gap-1">
                <Icon label="Subir" onClick={() => move(i, -1)} d="M6 15l6-6 6 6" />
                <Icon label="Descer" onClick={() => move(i, 1)} d="M6 9l6 6 6-6" />
                <Icon label={`Editar ${c.name}`} onClick={() => setEditing(c)} d="M4 20h4L19 9l-4-4L4 16z" />
              </span>
            </li>
          ))}
          {contacts.length === 0 && (
            <li className="rounded-2xl border border-line bg-white px-4 py-10 text-center text-sm font-bold text-muted">
              Ainda não há contactos. Sem contactos, o quiosque mostra “Em caso de emergência ligue 112”.
            </li>
          )}
        </ol>
      </div>
      <aside className="flex w-full max-w-[380px] flex-col gap-2">
        <span className="text-xs font-extrabold text-muted">Pré-visualização no quiosque</span>
        <div className="overflow-hidden rounded-2xl border border-line bg-ground">
          <div className="bg-alert px-4 py-3 text-[17px] font-black text-white">Contactos de emergência</div>
          <div className="grid grid-cols-2 gap-2 p-3">
            {contacts.map((c) => (
              <div key={c.id} className="rounded-xl border border-line bg-white px-3 py-2">
                <span className="block truncate text-xs font-black">{c.name}</span>
                <span className="block text-[17px] font-black text-danger">{c.phone}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
      {editing && (
        <ContactDialog
          contact={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Icon({ label, onClick, d }: { label: string; onClick: () => void; d: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-quiet hover:bg-ground">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
    </button>
  );
}

function ContactDialog({ contact, onClose, onSaved }: { contact: KioskContact | null; onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Modal title={contact ? "Editar contacto" : "Novo contacto"} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          if (contact) data.set("id", contact.id);
          start(async () => {
            const r = await saveContact(data);
            if (r.error) setError(r.error);
            else onSaved();
          });
        }}
      >
        <Field label="Nome">
          <input name="name" required maxLength={80} defaultValue={contact?.name} className="input" autoFocus />
        </Field>
        <Field label="Telefone">
          <input name="phone" type="tel" required maxLength={40} defaultValue={contact?.phone} className="input" />
        </Field>
        <Field label="Nota" hint="(opcional, ex.: Bombeiros)">
          <input name="note" maxLength={80} defaultValue={contact?.note} className="input" />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex flex-wrap items-center gap-2.5">
          {contact &&
            (confirm ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await deleteContact(contact.id);
                    if (r.error) setError(r.error);
                    else onSaved();
                  })
                }
                className="h-10 rounded-[10px] bg-danger px-3 text-sm font-extrabold text-white"
              >
                Confirmar apagar
              </button>
            ) : (
              <button type="button" onClick={() => setConfirm(true)} className="h-10 rounded-[10px] px-2 text-sm font-extrabold text-danger hover:bg-alert-soft">
                Apagar
              </button>
            ))}
          <span className="flex-1" />
          <SecondaryButton type="button" onClick={onClose}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={pending}>
            {pending ? "A guardar…" : "Guardar"}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
