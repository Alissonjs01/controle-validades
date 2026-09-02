import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

type GlassCardProps = HTMLAttributes<HTMLDivElement>;

export function GlassCard({ className, ...props }: GlassCardProps) {
  return <div className={cn("glass-card", className)} {...props} />;
}
