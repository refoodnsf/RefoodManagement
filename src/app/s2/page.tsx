import type { Metadata } from "next";
import { isKiosk } from "@/lib/kiosk";
import NotPaired from "../kiosk/not-paired";
import Kiosk from "./kiosk";

export const metadata: Metadata = { title: "Refood · Voluntários" };

export default async function S2Page() {
  if (!(await isKiosk())) return <NotPaired />;
  return <Kiosk />;
}
