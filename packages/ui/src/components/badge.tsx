import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../cn";

const badge = cva(
  "inline-flex items-center gap-1.5 rounded-xs px-2 py-0.5 font-mono text-[0.7rem] uppercase tracking-[0.08em]",
  {
    variants: {
      tone: {
        neutral: "bg-raised text-muted ring-1 ring-inset ring-line-strong",
        amber: "bg-amber-soft text-accent",
        success: "bg-green-soft text-green",
        danger: "bg-red-soft text-red",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {
  dot?: boolean;
}

export function Badge({ className, tone, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badge({ tone }), className)} {...props}>
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
