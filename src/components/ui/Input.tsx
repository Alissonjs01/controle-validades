import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Input({ className, id, label, ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label className="input-field" htmlFor={inputId}>
      <span>{label}</span>
      <input className={cn("input", className)} id={inputId} {...props} />
    </label>
  );
}
