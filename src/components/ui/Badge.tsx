import type { ReactNode } from "react";

// Tint + strong text + subtle border; the dot is decorative (the label carries the meaning).
const TONES = {
  neutral: { pill: "bg-surface-muted text-muted border-border-strong/70", dot: "bg-muted/60" },
  primary: { pill: "bg-primary-soft text-primary border-primary/25", dot: "bg-primary" },
  success: { pill: "bg-success-soft text-success border-success/25", dot: "bg-success" },
  warning: { pill: "bg-warning-soft text-warning border-warning/30", dot: "bg-goal-individual" },
  danger: { pill: "bg-danger-soft text-danger border-danger/25", dot: "bg-danger" },
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  const t = TONES[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${t.pill}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${t.dot}`} />
      {children}
    </span>
  );
}
