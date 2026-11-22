// WhatsApp message templates (SPEC §3.8). Flow 9 adds `overdue` here.

export type SessionNotificationType = "cancellation" | "modality_change";

type Vars = Record<string, string>;

const SIGNATURE = "this is Margarida Freitas from IIMF.";

export const TEMPLATES: Record<SessionNotificationType | "absence", string> = {
  absence:
    `Hello {recipient_name}, ${SIGNATURE} {student_name} was absent from today's {class_name} class ({date}, {start_time}). Please let me know if you need anything. Thank you!`,
  cancellation:
    `Hello {recipient_name}, ${SIGNATURE} The {class_name} class on {date} at {start_time} has been cancelled. Sorry for the inconvenience.`,
  modality_change:
    `Hello {recipient_name}, ${SIGNATURE} The {class_name} class on {date} at {start_time} will be {modality}. Thank you!`,
};

/** Fills every {placeholder}; throws if one is missing so no "{…}" can ever be sent (AC-7.1). */
export function renderTemplate(template: string, vars: Vars): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    if (value === undefined) throw new Error(`Missing template value: ${key}`);
    return value;
  });
}
