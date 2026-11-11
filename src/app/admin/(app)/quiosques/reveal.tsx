"use client";

import { useState } from "react";
import { SecondaryButton } from "../../ui";

export default function Reveal({ link }: { link: string }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!shown) {
    return (
      <SecondaryButton type="button" className="self-start" onClick={() => setShown(true)}>
        Mostrar link de emparelhamento
      </SecondaryButton>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <code className="break-all rounded-xl border border-line bg-ground p-3 font-mono text-[13px] select-all">{link}</code>
      <SecondaryButton
        type="button"
        className="self-start"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copiado" : "Copiar"}
      </SecondaryButton>
    </div>
  );
}
