import { Button, Logo } from "@glimpse/ui";
import Link from "next/link";
import { ThemeToggle } from "../theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Glimpse home" className="rounded-sm">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <Link href="/pricing" className="hidden rounded-md px-3 py-2.5 text-sm text-muted hover:text-paper sm:block">
            Pricing
          </Link>
          <Link href="/privacy" className="hidden rounded-md px-3 py-2.5 text-sm text-muted hover:text-paper sm:block">
            Privacy
          </Link>
          <Link href="/login" className="rounded-md px-3 py-2.5 text-sm text-muted hover:text-paper">
            Sign in
          </Link>
          <ThemeToggle />
          <Button asChild size="sm" className="ml-1">
            <Link href="/login?mode=signup">Start free</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="grid gap-2">
          <Logo />
          <p className="text-sm text-muted">Made for photographers. Private for guests.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <Link className="py-2 hover:text-paper" href="/pricing">Pricing</Link>
          <Link className="py-2 hover:text-paper" href="/privacy">Privacy</Link>
          <Link className="py-2 hover:text-paper" href="/terms">Terms</Link>
          <Link className="py-2 hover:text-paper" href="/privacy#delete">Delete my face data</Link>
        </nav>
      </div>
    </footer>
  );
}
