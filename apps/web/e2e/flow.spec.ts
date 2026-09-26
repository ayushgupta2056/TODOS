import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const PHOTOS = process.env.E2E_PHOTOS_DIR;
const SELFIE = process.env.E2E_SELFIE;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.skip(!PHOTOS || !SELFIE || !SERVICE, "set E2E_PHOTOS_DIR, E2E_SELFIE and SUPABASE_SERVICE_ROLE_KEY");

test("photographer uploads → worker processes → guest finds themselves", async ({ page, browser, baseURL }) => {
  const admin = createClient(SUPABASE_URL, SERVICE!, { auth: { persistSession: false } });
  const email = `e2e-${Date.now()}@glimpse.local`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;

  // Sign in + onboarding
  await page.goto(`/auth/callback?token_hash=${link.properties.hashed_token}&type=magiclink&next=/app`);
  await expect(page).toHaveURL(/\/app\/onboarding/);
  await page.getByLabel("Studio name").fill("E2E Studio");
  await page.getByRole("button", { name: "Continue" }).click();

  // Create event
  await expect(page).toHaveURL(/\/app\/events\/new/);
  await page.getByLabel("Event name").fill("E2E Reception");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page).toHaveURL(/\/app\/events\/[0-9a-f-]{36}/);
  const eventId = page.url().match(/events\/([0-9a-f-]{36})/)![1]!;

  // Upload (twice the first file to prove de-duplication)
  const files = readdirSync(PHOTOS!).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).map((f) => join(PHOTOS!, f));
  await page.locator('input[type="file"]').first().setInputFiles([...files, files[0]!]);
  await expect(page.getByRole("status").filter({ hasText: "added" })).toContainText(`${files.length} added`, { timeout: 120_000 });

  // Wait for the worker
  await expect
    .poll(
      async () => (await admin.from("events").select("processed_count, photo_count").eq("id", eventId).single()).data,
      { timeout: 120_000, intervals: [1000] },
    )
    .toEqual({ processed_count: files.length, photo_count: files.length });
  await expect(page.getByText("All processed")).toBeVisible({ timeout: 30_000 });
  const { data: ev } = await admin.from("events").select("slug").eq("id", eventId).single();

  // Guest: fresh context, no photographer cookies
  const guest = await (await browser.newContext({ baseURL })).newPage();
  await guest.goto(`/e/${ev!.slug}`);
  await guest.getByRole("link", { name: /Find my photos/ }).click();
  const cont = guest.getByRole("button", { name: "Continue to camera" });
  await expect(cont).toBeDisabled();
  await guest.getByText("I agree to Glimpse").click();
  await cont.click();
  await expect(guest).toHaveURL(/\/find$/);
  await guest.locator('input[type="file"]').setInputFiles(SELFIE!);
  await expect(guest.getByText(/You.re in/)).toBeVisible({ timeout: 30_000 });
  await guest.getByRole("link", { name: /See your photos/ }).click();
  await expect(guest).toHaveURL(/\/me$/);
  const tiles = guest.getByRole("button", { name: /^Open Photo \d+ of/ });
  expect(await tiles.count()).toBeGreaterThan(0);

  // ZIP streams
  const zip = await guest.request.get(`/e/${ev!.slug}`.replace("/e/", "/api/e/") + "/zip");
  expect(zip.status()).toBe(200);
  expect(zip.headers()["content-type"]).toBe("application/zip");

  // Privacy: no selfie-derived data persisted beyond the matched list
  const { data: sessions } = await admin.from("guest_sessions").select("*").eq("event_id", eventId);
  expect(sessions).toHaveLength(1);
  expect(Object.keys(sessions![0]!)).not.toContain("embedding");

  // Delete the event: embeddings vanish immediately
  await page.goto(`/app/events/${eventId}?tab=settings`);
  await page.getByLabel(/to confirm/).fill("E2E Reception");
  await page.getByRole("button", { name: /Delete event and all photos/ }).click();
  await expect(page).toHaveURL(/\/app\?deleted=1/);
  const { count } = await admin.from("faces").select("id", { count: "exact", head: true }).eq("event_id", eventId);
  expect(count).toBe(0);
});
