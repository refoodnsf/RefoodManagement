import { requireProfile, ROLE_LABEL } from "@/lib/auth";
import { initials } from "@/lib/domain";
import { signOut } from "../login/actions";
import { LeafMark } from "../ui";
import Nav from "./nav";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const profile = await requireProfile();
  const admin = profile.role === "administrador";
  return (
    <div className="flex min-h-screen flex-wrap items-stretch bg-ground">
      <aside className="flex flex-[1_1_240px] flex-col gap-7 border-r border-line bg-white px-4 py-6 md:max-w-[260px]">
        <div className="flex items-center gap-3 px-2">
          <LeafMark />
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-black">Refood</span>
            <span className="text-[13px] font-semibold text-muted">Gestão do núcleo</span>
          </span>
        </div>
        <Nav admin={admin} />
        <div className="mt-auto flex items-center gap-2.5 border-t border-line-soft px-2 pt-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
              admin ? "bg-peach text-clay" : "bg-leaf-soft text-leaf-deep"
            }`}
          >
            {initials(profile.name || profile.email)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-sm font-extrabold">{profile.name || profile.email}</span>
            <span className="text-xs font-bold text-muted">{ROLE_LABEL[profile.role]}</span>
          </span>
          <form action={signOut}>
            <button type="submit" className="rounded-lg p-2 text-[13px] font-bold text-leaf-link hover:bg-ground">
              Sair
            </button>
          </form>
        </div>
      </aside>
      <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-5 px-4 pb-12 pt-8 sm:px-10">{children}</main>
    </div>
  );
}
