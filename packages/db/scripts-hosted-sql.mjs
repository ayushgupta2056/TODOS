// Concatenate the migrations + hosted-only setup into one file you can paste into the
// Supabase SQL editor (Dashboard → SQL Editor → New query → Run).  `pnpm --filter @glimpse/db hosted-sql`
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const dir = new URL("./supabase/migrations/", import.meta.url);
const parts = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
let out = "-- Glimpse: full schema for a NEW hosted Supabase project. Generated; do not edit.\n";
out += "-- Run once in Dashboard -> SQL Editor. Re-running on an existing project will fail (tables exist).\n\n";
for (const f of parts) out += `-- ===== ${f} =====\n${readFileSync(new URL(f, dir), "utf8")}\n`;
out += `-- ===== storage bucket (private; 50 MB per file on the free plan) =====
insert into storage.buckets (id, name, public, file_size_limit)
values ('glimpse', 'glimpse', false, 52428800)
on conflict (id) do nothing;
`;
writeFileSync(new URL("./hosted-setup.sql", import.meta.url), out);
console.log(`wrote hosted-setup.sql from ${parts.length} migrations`);
