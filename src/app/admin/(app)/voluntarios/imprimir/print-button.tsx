"use client";

import { PrimaryButton } from "../../../ui";

export default function PrintButton() {
  return (
    <PrimaryButton type="button" onClick={() => window.print()}>
      Imprimir
    </PrimaryButton>
  );
}
