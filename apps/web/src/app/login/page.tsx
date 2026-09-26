import { Logo } from "@glimpse/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.next?.startsWith("/app") ? sp.next : "/app";
  const signup = sp.mode === "signup";
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Link href="/" className="self-start rounded-sm" aria-label="Glimpse home">
          <Logo />
        </Link>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 py-12">
          <div className="grid gap-3">
            <h1 className="font-display text-5xl leading-none">
              {signup ? "Start your first event." : "Welcome back."}
            </h1>
            <p className="text-muted">
              {signup
                ? "Free for your first 500 photos. No card needed."
                : "We'll email you a sign-in link. No password to remember."}
            </p>
          </div>
          <LoginForm next={next} initialError={sp.error === "link" ? "That sign-in link has expired. Ask for a new one." : undefined} />
          <p className="text-xs text-faint">
            By continuing you agree to the <Link className="underline underline-offset-2 hover:text-paper" href="/terms">terms</Link> and{" "}
            <Link className="underline underline-offset-2 hover:text-paper" href="/privacy">privacy notice</Link>.
          </p>
        </main>
      </div>
      <div data-theme="dark" className="vignette grain relative hidden overflow-hidden border-l border-line bg-ink lg:block">
        <img src="/marketing/frame-2.webp" alt="" className="absolute inset-0 size-full object-cover" />
        <p className="absolute bottom-10 left-10 z-[2] max-w-sm font-display text-4xl italic leading-tight text-paper/90">
          &ldquo;Four thousand photos, and every guest found theirs before the cake was cut.&rdquo;
        </p>
      </div>
    </div>
  );
}
