import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile, homeFor } from "@/lib/auth";
import { LeafMark } from "../ui";
import LoginForm from "./form";

export const metadata: Metadata = { title: "Entrar · Refood" };

export default async function LoginPage() {
  const profile = await getProfile();
  if (profile) redirect(homeFor(profile.role));
  return (
    <main className="flex min-h-screen items-center justify-center bg-ground p-4">
      <div className="flex w-full max-w-[420px] flex-col gap-6 rounded-[20px] border border-line bg-white p-8">
        <div className="flex items-center gap-3">
          <LeafMark />
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-black">Refood</span>
            <span className="text-[13px] font-semibold text-muted">Gestão do núcleo</span>
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-black">Entrar</h1>
          <p className="text-sm font-semibold text-muted">Só entram pessoas convidadas.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
