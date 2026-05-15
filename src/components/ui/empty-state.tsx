import type { ReactNode } from "react";

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="surface rounded-lg border-dashed p-8 text-center">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {title}
      </h2>
      <div className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
        {children}
      </div>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
