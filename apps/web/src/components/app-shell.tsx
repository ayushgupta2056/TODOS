import { Logo, cn } from "@glimpse/ui";
import { CreditCard, Images, LogOut, Palette, Plus } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { NavLink } from "./nav-link";

const nav = [
  { href: "/app", label: "Events", icon: Images, exact: true },
  { href: "/app/brand", label: "Brand", icon: Palette },
  { href: "/app/billing", label: "Plan & usage", icon: CreditCard },
];

export function AppShell({ studioName, plan, children }: { studioName: string; plan: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-amber focus:px-4 focus:py-2 focus:text-amber-ink">
        Skip to content
      </a>
      {/* Rail (desktop) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface/40 px-3 py-5 lg:flex">
        <Link href="/app" className="mb-8 self-start rounded-sm px-2" aria-label="Glimpse — events">
          <Logo />
        </Link>
        <Link
          href="/app/events/new"
          className="mb-6 flex h-11 items-center gap-2 rounded-md bg-amber px-3 text-sm font-medium text-amber-ink hover:bg-amber-hover"
        >
          <Plus className="size-4" aria-hidden /> New event
        </Link>
        <nav aria-label="Studio" className="grid gap-0.5">
          {nav.map((n) => (
            <NavLink key={n.href} href={n.href} exact={n.exact}>
              <n.icon className="size-4" aria-hidden />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto grid gap-3 border-t border-line px-2 pt-4">
          <div className="grid gap-0.5">
            <p className="truncate text-sm font-medium">{studioName}</p>
            <p className="font-mono text-[0.7rem] uppercase tracking-wider text-muted">{plan} plan</p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <form action="/auth/signout" method="post">
              <button className="grid size-11 place-items-center rounded-md text-muted hover:bg-raised hover:text-paper" aria-label="Sign out">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>
      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-ink/85 px-4 backdrop-blur lg:hidden">
        <Link href="/app" aria-label="Glimpse — events" className="rounded-sm">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link href="/app/events/new" aria-label="New event" className="grid size-11 place-items-center rounded-md bg-amber text-amber-ink">
            <Plus className="size-4" />
          </Link>
        </div>
      </header>
      <main id="main" className={cn("min-w-0 pb-24 lg:pb-10")}>{children}</main>
      {/* Bottom nav (mobile) */}
      <nav aria-label="Studio" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {nav.map((n) => (
          <NavLink key={n.href} href={n.href} exact={n.exact} mobile>
            <n.icon className="size-5" aria-hidden />
            <span className="text-[0.7rem]">{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
