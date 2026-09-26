"use client";

import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { Toast as T } from "radix-ui";
import * as React from "react";
import { cn } from "../cn";

type Tone = "neutral" | "success" | "danger";
interface ToastItem {
  id: number;
  title: string;
  description?: string | undefined;
  tone: Tone;
}

type Listener = (items: ToastItem[]) => void;
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
function emit() {
  for (const l of listeners) l(items);
}

export function toast(title: string, opts: { description?: string; tone?: Tone } = {}): void {
  items = [...items, { id: nextId++, title, description: opts.description, tone: opts.tone ?? "neutral" }].slice(-3);
  emit();
}
toast.success = (title: string, description?: string) =>
  toast(title, { tone: "success", ...(description ? { description } : {}) });
toast.error = (title: string, description?: string) =>
  toast(title, { tone: "danger", ...(description ? { description } : {}) });

function dismiss(id: number) {
  items = items.filter((i) => i.id !== id);
  emit();
}

const icons = { neutral: Info, success: CheckCircle2, danger: CircleAlert } as const;

export function Toaster() {
  const [list, setList] = React.useState<ToastItem[]>(items);
  React.useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  return (
    <T.Provider swipeDirection="down" duration={4500}>
      {list.map((t) => {
        const Icon = icons[t.tone];
        return (
          <T.Root
            key={t.id}
            onOpenChange={(open) => {
              if (!open) dismiss(t.id);
            }}
            className={cn(
              "group pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-line-strong bg-raised p-4 pr-12 shadow-xl shadow-black/30",
              "data-[state=open]:animate-[toast-in_320ms_cubic-bezier(0.22,1,0.36,1)] data-[state=closed]:animate-[fade-out_160ms_ease-in]",
              "data-[swipe=move]:translate-y-[var(--radix-toast-swipe-move-y)] data-[swipe=cancel]:translate-y-0 data-[swipe=cancel]:transition-transform",
              "data-[swipe=end]:animate-[fade-out_160ms_ease-in]",
            )}
          >
            <Icon
              aria-hidden
              className={cn(
                "mt-0.5 size-4 shrink-0",
                t.tone === "success" && "text-green",
                t.tone === "danger" && "text-red",
                t.tone === "neutral" && "text-amber",
              )}
            />
            <div className="grid gap-0.5">
              <T.Title className="text-sm font-medium">{t.title}</T.Title>
              {t.description ? (
                <T.Description className="text-sm text-muted">{t.description}</T.Description>
              ) : null}
            </div>
            <T.Close
              aria-label="Dismiss"
              className="absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-md text-muted hover:text-paper"
            >
              <X className="size-4" />
            </T.Close>
          </T.Root>
        );
      })}
      <T.Viewport className="pointer-events-none fixed bottom-0 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 p-4 outline-none sm:left-auto sm:right-0 sm:translate-x-0" />
    </T.Provider>
  );
}
