// Creates (or resets) a System 3 "Administrador" account.
// Usage: node --env-file=.env.local scripts/create-admin.mjs <email> "<name>"
// Prints a temporary password once; change it after the first login.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const [email, name = ""] = process.argv.slice(2);
if (!email) {
  console.error('Usage: node --env-file=.env.local scripts/create-admin.mjs <email> "<name>"');
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key, { auth: { persistSession: false } });

const password = randomBytes(9).toString("base64url");

const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
let user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

if (user) {
  const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
  if (error) throw error;
} else {
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  user = data.user;
}

const { error: profileError } = await supabase
  .from("profiles")
  .upsert({ user_id: user.id, email: email.toLowerCase(), name, role: "administrador" });
if (profileError) throw profileError;

console.log(`Administrador ready: ${email}`);
console.log(`Temporary password: ${password}`);
