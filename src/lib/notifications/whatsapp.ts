/**
 * `https://wa.me/<E.164 digits>?text=<url-encoded message>` (SPEC §3.8, AC-7.2).
 * "+351 912 345 678" → "https://wa.me/351912345678?text=…".
 */
export function waLink(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
