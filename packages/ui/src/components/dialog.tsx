"use client";

import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import * as React from "react";
import { cn } from "../cn";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

const overlay =
  "fixed inset-0 z-50 bg-scrim backdrop-blur-[2px] data-[state=open]:animate-[fade-in_200ms_ease-out] data-[state=closed]:animate-[fade-out_150ms_ease-in]";

export function DialogContent({
  className,
  children,
  title,
  description,
  hideClose,
  ...props
}: React.ComponentProps<typeof D.Content> & {
  title: string;
  description?: React.ReactNode;
  hideClose?: boolean;
}) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2",
          "rounded-xl border border-line bg-surface p-6 shadow-2xl shadow-black/40",
          "data-[state=open]:animate-[dialog-in_260ms_cubic-bezier(0.22,1,0.36,1)]",
          "focus:outline-none",
          className,
        )}
        {...props}
      >
        <div className="mb-5 grid gap-1.5 pr-8">
          <D.Title className="font-display text-3xl leading-tight tracking-tight">{title}</D.Title>
          {description ? (
            <D.Description className="text-sm text-muted">{description}</D.Description>
          ) : (
            <D.Description className="sr-only">{title}</D.Description>
          )}
        </div>
        {children}
        {hideClose ? null : (
          <D.Close
            className="absolute right-3 top-3 grid size-11 place-items-center rounded-md text-muted hover:bg-raised hover:text-paper"
            aria-label="Close"
          >
            <X className="size-4" />
          </D.Close>
        )}
      </D.Content>
    </D.Portal>
  );
}

export function Sheet(props: React.ComponentProps<typeof D.Root>) {
  return <D.Root {...props} />;
}
export const SheetTrigger = D.Trigger;
export const SheetClose = D.Close;

export function SheetContent({
  side = "right",
  title,
  description,
  className,
  children,
  ...props
}: React.ComponentProps<typeof D.Content> & {
  side?: "right" | "bottom";
  title: string;
  description?: React.ReactNode;
}) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        className={cn(
          "fixed z-50 flex flex-col border-line bg-surface shadow-2xl shadow-black/40 focus:outline-none",
          side === "right" &&
            "inset-y-0 right-0 w-full max-w-md border-l data-[state=open]:animate-[sheet-right_320ms_cubic-bezier(0.22,1,0.36,1)]",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-xl border-t pb-[env(safe-area-inset-bottom)] data-[state=open]:animate-[sheet-up_360ms_cubic-bezier(0.22,1,0.36,1)]",
          className,
        )}
        {...props}
      >
        {side === "bottom" ? (
          <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong" />
        ) : null}
        <div className="flex items-start justify-between gap-4 p-5 pb-3 sm:p-6 sm:pb-3">
          <div className="grid gap-1">
            <D.Title className="font-display text-2xl leading-tight">{title}</D.Title>
            {description ? (
              <D.Description className="text-sm text-muted">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <D.Close
            className="grid size-11 shrink-0 place-items-center rounded-md text-muted hover:bg-raised hover:text-paper"
            aria-label="Close"
          >
            <X className="size-4" />
          </D.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-6">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
