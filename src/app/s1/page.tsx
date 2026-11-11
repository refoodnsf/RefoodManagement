import type { Metadata } from "next";
import { isKiosk } from "@/lib/kiosk";
import Kiosk from "./kiosk";

export const metadata: Metadata = { title: "Refood · Beneficiários" };

export default async function S1Page() {
  if (!(await isKiosk())) {
    return (
      <main className="kiosk flex min-h-screen flex-col items-center justify-center gap-4 bg-ground p-10 text-center">
        <h1 className="text-[44px] font-black leading-tight">Este ecrã ainda não está autorizado</h1>
        <p className="text-[24px] font-semibold text-muted">This screen is not authorised yet</p>
        <p className="max-w-[720px] text-[20px] font-semibold text-quiet">
          Abra o link de emparelhamento do quiosque neste dispositivo (pedir a um administrador).
          <br />
          <span className="text-muted">Open the kiosk pairing link on this device (ask an administrator).</span>
        </p>
      </main>
    );
  }
  return <Kiosk centreName={process.env.CENTRE_NAME ?? ""} />;
}
