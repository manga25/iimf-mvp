import { Icon } from "@/components/layout/icons";

type IconName = Parameters<typeof Icon>[0]["name"];

const TONES = {
  primary: "bg-primary-soft text-primary ring-primary/15",
  success: "bg-success-soft text-success ring-success/15",
  warning: "bg-warning-soft text-warning ring-warning/20",
  danger: "bg-danger-soft text-danger ring-danger/15",
} as const;

/** Purely decorative tinted icon tile placed next to a section heading. */
export function IconBadge({ name, tone = "primary" }: { name: IconName; tone?: keyof typeof TONES }) {
  return (
    <span aria-hidden="true" className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${TONES[tone]}`}>
      <Icon name={name} className="size-[18px]" />
    </span>
  );
}

/** Coloured top accent for dashboard cards (pair with `card`). */
export const ACCENT = {
  primary: "border-t-[3px] border-t-primary",
  success: "border-t-[3px] border-t-success",
  warning: "border-t-[3px] border-t-goal-individual",
  danger: "border-t-[3px] border-t-danger",
} as const;
