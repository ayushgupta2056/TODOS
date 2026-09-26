import { cn } from "../cn";

/** Aperture ring with a safelight dot. Monochrome, works at 16px. */
export function LogoMark({ className, title = "Glimpse" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} role="img" aria-label={title}>
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M16 3 A13 13 0 0 1 28.4 12.1 M29 16 A13 13 0 0 1 20.2 28.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.35"
      />
      <circle cx="16" cy="16" r="3.2" fill="var(--amber)" />
    </svg>
  );
}

export function Logo({ className, name = "Glimpse" }: { className?: string; name?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-paper", className)}>
      <LogoMark title="" />
      <span className="font-display text-[1.6rem] italic leading-none tracking-tight">{name}</span>
    </span>
  );
}
