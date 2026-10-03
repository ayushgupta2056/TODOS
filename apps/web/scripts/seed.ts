/**
 * Local dev seed: a demo photographer, studio and event, optionally filled from a folder.
 *
 *   pnpm --filter @glimpse/web seed [./path/to/photos]
 *
 * Prints a one-click sign-in URL for the demo photographer. Dev only: never run against prod.
 * Use your own (or consented) photos — keep real face data out of git.
 */
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";

function loadEnv(): void {
  try {
    for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2];
    }
  } catch {
    // rely on the real environment
  }
}
loadEnv();

const need = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`missing ${k}`);
  return v;
};

const EMAIL = process.env.SEED_EMAIL ?? "demo@glimpse.local";
const SLUG = process.env.SEED_SLUG ?? "demo-sangeet";
const APP = process.env.APP_URL ?? "http://localhost:3000";
const folder = process.argv[2];

const admin = createClient(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const s3 = new AwsClient({
  accessKeyId: need("S3_ACCESS_KEY_ID"),
  secretAccessKey: need("S3_SECRET_ACCESS_KEY"),
  ...(process.env.S3_SESSION_TOKEN ? { sessionToken: process.env.S3_SESSION_TOKEN } : {}),
  service: "s3",
  region: process.env.S3_REGION ?? "us-east-1",
});
const bucketUrl = `${need("S3_ENDPOINT").replace(/\/$/, "")}/${need("S3_BUCKET")}`;

async function ensureBucket(): Promise<void> {
  const head = await s3.fetch(bucketUrl, { method: "HEAD" });
  if (head.status === 404) await s3.fetch(bucketUrl, { method: "PUT" });
  const cors = `<CORSConfiguration><CORSRule><AllowedOrigin>${APP}</AllowedOrigin><AllowedOrigin>http://127.0.0.1:3000</AllowedOrigin><AllowedMethod>GET</AllowedMethod><AllowedMethod>PUT</AllowedMethod><AllowedMethod>POST</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>`;
  const md5 = createHash("md5").update(cors).digest("base64");
  // R2/SeaweedFS accept bucket CORS; MinIO answers NotImplemented and uses MINIO_API_CORS_ALLOW_ORIGIN instead.
  await s3.fetch(`${bucketUrl}?cors`, { method: "PUT", body: cors, headers: { "content-md5": md5, "content-type": "application/xml" } }).catch(() => undefined);
}

async function main(): Promise<void> {
  await ensureBucket();

  const { data: list } = await admin.auth.admin.listUsers();
  let user = list.users.find((u) => u.email === EMAIL);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, email_confirm: true });
    if (error) throw error;
    user = data.user;
  }

  let { data: studio } = await admin.from("studios").select("*").eq("owner_id", user.id).maybeSingle();
  if (!studio) {
    const { data, error } = await admin.from("studios").insert({ owner_id: user.id, name: "Golden Hour Studios", plan: "pro" }).select().single();
    if (error) throw error;
    studio = data;
  }

  let { data: event } = await admin.from("events").select("*").eq("slug", SLUG).maybeSingle();
  if (!event) {
    const { data, error } = await admin
      .from("events")
      .insert({
        studio_id: studio.id,
        slug: SLUG,
        name: "Priya & Arjun — Sangeet",
        event_date: new Date().toISOString().slice(0, 10),
        expires_at: new Date(Date.now() + 90 * 864e5).toISOString(),
        show_all_gallery: true,
      })
      .select()
      .single();
    if (error) throw error;
    event = data;
  }

  if (folder) {
    const files = readdirSync(folder).filter((f) => [".jpg", ".jpeg", ".png", ".webp"].includes(extname(f).toLowerCase()));
    let added = 0;
    for (const f of files) {
      const path = join(folder, f);
      if (!statSync(path).isFile()) continue;
      const body = readFileSync(path);
      const ext = extname(f).toLowerCase().replace(".jpeg", ".jpg").slice(1);
      const key = `events/${event.id}/original/${randomUUID()}.${ext}`;
      const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const put = await s3.fetch(`${bucketUrl}/${key}`, { method: "PUT", body, headers: { "content-type": type } });
      if (!put.ok) throw new Error(`upload failed ${put.status}`);
      const { data, error } = await admin.rpc("register_photo", {
        p_event_id: event.id,
        p_key: key,
        p_name: f,
        p_content_type: type,
        p_bytes: body.length,
        p_sha256: createHash("sha256").update(body).digest("hex"),
      });
      if (error) throw error;
      if (data?.[0]?.created) added++;
    }
    console.log(`queued ${added} new photos (${files.length - added} already present)`);
    // Free hosts sleep the worker when idle: poke it so the queue gets processed.
    if (process.env.WORKER_URL) await fetch(`${process.env.WORKER_URL}/healthz`).catch(() => undefined);
  }

  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  if (error) throw error;
  console.log(`\nStudio:  ${studio.name} (${studio.plan})`);
  console.log(`Guest:   ${APP}/e/${event.slug}`);
  console.log(`Sign in: ${APP}/auth/callback?token_hash=${link.properties.hashed_token}&type=magiclink&next=/app/events/${event.id}\n`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
