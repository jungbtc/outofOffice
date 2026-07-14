import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon?: ReactNode;
  active?: boolean;
}

export function ToolbarButton({
  label,
  icon,
  active = false,
  className = "",
  ...props
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      className={`toolbar-button ${active ? "is-active" : ""} ${className}`}
      title={label}
      {...props}
    >
      {icon ?? label}
    </button>
  );
}
