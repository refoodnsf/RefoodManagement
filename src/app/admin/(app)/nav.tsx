"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Painel", icon: "M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z", admin: true },
  { href: "/admin/beneficiarios", label: "Beneficiários", icon: "M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z", admin: false },
  { href: "/admin/voluntarios", label: "Voluntários", icon: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6", admin: true },
  { href: "/admin/tarefas", label: "Tarefas", icon: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2", admin: true },
  { href: "/admin/contactos", label: "Contactos", icon: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2", admin: true },
  { href: "/admin/eventos", label: "Eventos", icon: "M4 5h16v16H4zM4 10h16M8 3v4M16 3v4", admin: true },
  { href: "/admin/fotos", label: "Fotos", icon: "M3 4h18v16H3zM21 16l-5-5-9 9M9 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4", admin: true },
  { href: "/admin/registos", label: "Registos", icon: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7", admin: true },
  { href: "/admin/quiosques", label: "Quiosques", icon: "M3 4h18v12H3zM8 20h8M12 16v4", admin: true },
  { href: "/admin/utilizadores", label: "Utilizadores", icon: "M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM9 12l2 2 4-4", admin: true },
  { href: "/admin/conta", label: "A minha conta", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a7 7 0 0 1 16 0v1", admin: false },
];

export default function Nav({ admin }: { admin: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-1">
      {ITEMS.filter((i) => admin || !i.admin).map((i) => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] ${
              active ? "bg-leaf-soft font-extrabold text-leaf-deep" : "font-bold text-quiet hover:bg-ground"
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={i.icon} />
            </svg>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
