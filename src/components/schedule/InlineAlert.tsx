import type { ReactNode } from "react";

const TONES = {
  danger: "border-danger/30 bg-danger-soft text-danger",
  warning: "border-warning/25 bg-warning-soft text-warning",
} as const;

/** Small inline message under an action; errors are announced to screen readers. */
export function InlineAlert({ tone = "danger", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <p role={tone === "danger" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${TONES[tone]}`}>
      {children}
    </p>
  );
}
