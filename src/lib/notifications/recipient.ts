export type Recipient = "student" | "guardian";

type Contact = { full_name: string; phone: string; guardian_name: string | null; guardian_phone: string | null };

/** SPEC §3.8: every type except `absence` goes to the guardian if one exists, otherwise to the student. */
export function primaryRecipient(s: Contact): { recipient: Recipient; name: string; phone: string } {
  if (s.guardian_name && s.guardian_phone) return { recipient: "guardian", name: s.guardian_name, phone: s.guardian_phone };
  return { recipient: "student", name: s.full_name, phone: s.phone };
}
