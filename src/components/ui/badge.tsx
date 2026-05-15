import type { ReactNode } from "react";

type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent";

const toneClassName: Record<BadgeTone, string> = {
  neutral: "text-zinc-700 dark:text-zinc-300",
  success: "text-emerald-700 dark:text-emerald-300",
  warning: "text-amber-700 dark:text-amber-300",
  danger: "text-red-700 dark:text-red-300",
  info: "text-sky-700 dark:text-sky-300",
  accent: "text-teal-700 dark:text-teal-300",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`status-pill inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${toneClassName[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
