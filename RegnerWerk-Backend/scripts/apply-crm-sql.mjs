#!/usr/bin/env node
/**
 * Apply 002_crm_foundation.sql via Supabase Management API.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-crm-sql.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REF = "cndwhjqjhgydapqaotgn";
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!token) {
  console.error(
    "Set SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens),\n" +
      "or paste supabase/migrations/002_crm_foundation.sql into SQL Editor manually.",
  );
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sql = readFileSync(
  resolve(root, "supabase/migrations/002_crm_foundation.sql"),
  "utf8",
);

const res = await fetch(
  `https://api.supabase.com/v1/projects/${REF}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  },
);

const text = await res.text();
if (!res.ok) {
  console.error(res.status, text);
  process.exit(1);
}
console.log("OK", text.slice(0, 800));
