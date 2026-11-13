import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { getKioskContacts } from "@/lib/s2";
import { PageHeader } from "../../ui";
import Contacts from "./client";

export const metadata: Metadata = { title: "Contactos · Refood" };

export default async function ContactsPage() {
  await requireProfile(["administrador"]);
  const contacts = await getKioskContacts();
  return (
    <>
      <PageHeader title="Contactos de emergência" subtitle="Aparecem no quiosque de voluntários, por esta ordem, em menos de 10 segundos." />
      <Contacts contacts={contacts} />
    </>
  );
}
