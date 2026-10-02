import "server-only";
import { z } from "zod";

const schema = z.object({
  APP_URL: z.url().default(process.env.RENDER_EXTERNAL_URL ?? "http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  // Server-side Supabase URL when it differs from the browser one (e.g. behind a tunnel/CDN).
  SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  S3_ENDPOINT: z.url(),
  // Host browsers use for presigned URLs, if different from S3_ENDPOINT (custom R2 domain, tunnel).
  S3_PUBLIC_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  // Supabase Storage session-token auth (key id = project ref, secret = anon key, token = service_role JWT).
  S3_SESSION_TOKEN: z.string().optional(),
  WORKER_URL: z.url(),
  WORKER_TOKEN: z.string().min(8),
  MATCH_THRESHOLD: z.coerce.number().min(0).max(1).default(0.42),
  CLUSTER_MATCH_THRESHOLD: z.coerce.number().min(0).max(1).default(0.55),
  GUEST_SECRET: z.string().min(32),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_PLAN_STARTER: z.string().optional(),
  RAZORPAY_PLAN_PRO: z.string().optional(),
  RAZORPAY_PLAN_STUDIO: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated server env. Throws a readable error listing every missing/invalid variable. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables (see apps/web/.env.example):\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
