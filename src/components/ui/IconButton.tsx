import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function IconButton({
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return <button className={cn("icon-button", className)} type={type} {...props} />;
}
