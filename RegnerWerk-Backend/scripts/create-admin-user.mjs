#!/usr/bin/env node
/**
 * Create an invite-only admin user and assign Owner role.
 *
 *   node scripts/create-admin-user.mjs email@example.com 'StrongPassword!'
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
const password = process.argv[3];
if (!email || !password) {
  console.error("Usage: node scripts/create-admin-user.mjs <email> <password>");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env in .env.local");
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await sb.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { display_name: email.split("@")[0] },
});
if (error) {
  console.error(error.message);
  process.exit(1);
}

const userId = data.user.id;
console.log("Created user", userId);

// Ensure profile (trigger may have created it)
await sb.from("profiles").upsert({
  id: userId,
  display_name: email.split("@")[0],
  active: true,
});

const { data: ownerRole, error: roleErr } = await sb
  .from("roles")
  .select("id")
  .eq("code", "owner")
  .maybeSingle();
if (roleErr || !ownerRole) {
  console.error("Owner role missing — run migration 006_auth_rbac.sql first");
  process.exit(1);
}

const { error: urErr } = await sb.from("user_roles").upsert({
  user_id: userId,
  role_id: ownerRole.id,
});
if (urErr) {
  console.error(urErr.message);
  process.exit(1);
}

console.log("Assigned owner role. Login at http://localhost:3001/login");
