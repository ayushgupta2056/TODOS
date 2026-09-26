"use client";

import { cn } from "@glimpse/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  exact,
  mobile,
  children,
}: {
  href: string;
  exact?: boolean | undefined;
  mobile?: boolean;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const active = exact ? path === href || path.startsWith("/app/events") : path.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        mobile
          ? "flex min-h-14 flex-col items-center justify-center gap-1 text-muted"
          : "flex h-10 items-center gap-2.5 rounded-md px-3 text-sm text-muted hover:bg-raised hover:text-paper",
        active && (mobile ? "text-amber" : "bg-raised text-paper"),
      )}
    >
      {children}
    </Link>
  );
}
