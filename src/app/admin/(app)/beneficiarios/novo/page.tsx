import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { PageHeader } from "../../../ui";
import BeneficiaryForm from "../form";
import { createBeneficiary } from "../actions";

export const metadata: Metadata = { title: "Novo beneficiário · Refood" };

export default async function NewBeneficiaryPage() {
  await requireProfile(["administrador", "gestor_beneficiarios"]);
  return (
    <>
      <PageHeader title="Adicionar beneficiário" subtitle="O número é atribuído automaticamente ao guardar." />
      <BeneficiaryForm
        action={createBeneficiary}
        initial={{ name: "", type: "familia", adults: 1, children: 0, food_needs: [], food_notes: "", active: true }}
      />
    </>
  );
}
