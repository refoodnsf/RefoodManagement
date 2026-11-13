import type { Metadata } from "next";
import { isKiosk } from "@/lib/kiosk";
import NotPaired from "../kiosk/not-paired";
import Kiosk from "./kiosk";

export const metadata: Metadata = { title: "Refood · Beneficiários" };

export default async function S1Page() {
  if (!(await isKiosk())) return <NotPaired />;
  return <Kiosk centreName={process.env.CENTRE_NAME ?? ""} />;
}
