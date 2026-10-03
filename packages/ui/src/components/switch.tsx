"use client";

import { Switch as S } from "radix-ui";
import * as React from "react";
import { cn } from "../cn";

export function Switch({ className, ...props }: React.ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-control bg-raised",
        "transition-colors duration-200 data-[state=checked]:border-amber data-[state=checked]:bg-amber",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50",
        // 44px hit area without changing visual size
        "before:absolute before:-inset-2 before:content-['']",
        className,
      )}
      {...props}
    >
      <S.Thumb
        className={cn(
          "block size-5 translate-x-1 rounded-full bg-paper shadow transition-transform duration-200 ease-out-quint",
          "data-[state=checked]:translate-x-[1.35rem] data-[state=checked]:bg-amber-ink",
        )}
      />
    </S.Root>
  );
}
