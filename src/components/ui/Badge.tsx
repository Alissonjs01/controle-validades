import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

type BadgeVariant = "normal" | "attention" | "urgent" | "expired" | "info";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({ className, variant = "info", ...props }: BadgeProps) {
  return (
    <span
      className={cn("badge", `badge--${variant}`, className)}
      {...props}
    />
  );
}
