import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/admin";

export type Role = "administrador" | "gestor_beneficiarios";

export type Profile = {
  userId: string;
  email: string;
  name: string;
  role: Role;
};

export const ROLE_LABEL: Record<Role, string> = {
  administrador: "Administrador",
  gestor_beneficiarios: "Gestor Beneficiários",
};

/** The signed-in coordinator, or null. Cached per request. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await authClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: row } = await db()
    .from("profiles")
    .select("user_id, email, name, role")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!row) return null;
  return { userId: row.user_id, email: row.email, name: row.name, role: row.role };
});

/** Require a signed-in coordinator, optionally with one of the given roles. */
export async function requireProfile(roles?: Role[]): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/admin/login");
  if (roles && !roles.includes(profile.role)) redirect(homeFor(profile.role));
  return profile;
}

export function homeFor(role: Role) {
  return role === "administrador" ? "/admin" : "/admin/beneficiarios";
}
