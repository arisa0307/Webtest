import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-border bg-card shadow-xs",
        className
      )}
      {...props}
    />
  );
}

export function Notice({
  variant = "info",
  children,
}: {
  variant?: "info" | "warning" | "error";
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-muted text-muted-foreground",
    warning: "bg-amber-50 text-amber-800 border border-amber-200",
    error: "bg-red-50 text-red-700 border border-red-200",
  }[variant];
  return (
    <div className={cn("rounded-[var(--radius)] px-3 py-2 text-sm", styles)}>
      {children}
    </div>
  );
}
