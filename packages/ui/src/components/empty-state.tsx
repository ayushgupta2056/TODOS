import * as React from "react";
import { cn } from "../cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-line-strong px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="grid size-12 place-items-center rounded-full border border-line-strong text-muted [&_svg]:size-5">
          {icon}
        </div>
      ) : null}
      <div className="grid max-w-sm gap-1.5">
        <h3 className="font-display text-2xl leading-tight">{title}</h3>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
