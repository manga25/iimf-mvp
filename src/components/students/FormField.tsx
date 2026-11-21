import type { ReactNode } from "react";

export type FieldA11y = { id: string; "aria-invalid"?: true; "aria-describedby"?: string };

type Props = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: (a11y: FieldA11y) => ReactNode;
};

/** Label + control + hint + error, wired together for screen readers. */
export function FormField({ id, label, error, hint, optional, children }: Props) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && <p id={hintId} className="text-xs text-muted">{hint}</p>}
      {error && <p id={errorId} className="text-sm text-danger">{error}</p>}
    </div>
  );
}
