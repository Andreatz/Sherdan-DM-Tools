import type { ReactNode } from "react";

export function Panel({
  children,
  className = "",
  raised = false,
}: {
  children: ReactNode;
  className?: string;
  raised?: boolean;
}) {
  return (
    <section
      className={`${raised ? "surface-raised" : "surface"} rounded-lg ${className}`}
    >
      {children}
    </section>
  );
}
