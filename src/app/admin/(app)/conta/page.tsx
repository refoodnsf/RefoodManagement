import type { Metadata } from "next";
import { ROLE_LABEL, requireProfile } from "@/lib/auth";
import { Card, PageHeader } from "../../ui";
import PasswordForm from "./form";

export const metadata: Metadata = { title: "A minha conta · Refood" };

export default async function AccountPage() {
  const me = await requireProfile();
  return (
    <>
      <PageHeader title="A minha conta" subtitle={`${me.email} · ${ROLE_LABEL[me.role]}`} />
      <Card className="max-w-[480px] p-6">
        <h2 className="mb-4 text-[19px] font-black">Mudar palavra-passe</h2>
        <PasswordForm />
      </Card>
    </>
  );
}
