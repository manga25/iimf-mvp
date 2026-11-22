"use client";

import { useId, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { useApiAction } from "@/components/calendar/useApiAction";
import { NM } from "@/lib/notifications/messages";
import { MESSAGE_MAX, type Notification } from "@/lib/notifications/types";
import { validateMessage } from "@/lib/notifications/validation";
import { waLink } from "@/lib/notifications/whatsapp";

type Props = { notification: Pick<Notification, "id" | "phone" | "message" | "recipient_name"> };

const noSubscribe = () => () => {};
/** False in the server HTML, true once React has hydrated (so typing before that can't be lost). */
const useHydrated = () => useSyncExternalStore(noSubscribe, () => true, () => false);

/**
 * Editable message of a pending notification (saved when it loses focus) plus
 * Copy message / Open WhatsApp (both mark it Sent with the current text) and Dismiss.
 */
export function NotificationActions({ notification }: Props) {
  const [text, setText] = useState(notification.message);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { run, pending: sending, error } = useApiAction();
  const hydrated = useHydrated();
  const pending = sending || !hydrated;
  // Set on pointer-down of an action, which fires before the textarea's blur:
  // that action carries (or discards) the text, so the blur must not save it too.
  const acting = useRef(false);
  const id = useId();
  const path = `/api/notifications/${notification.id}`;
  const shownError = localError ?? error;

  function checked(): string | null {
    const result = validateMessage(text);
    setLocalError(result.ok ? null : result.error);
    return result.ok ? result.value : null;
  }

  async function save() {
    if (acting.current || text.trim() === notification.message) return;
    const message = checked();
    if (message && (await run("PATCH", path, { action: "save", message }))) setNotice("Message saved.");
  }

  async function copy() {
    acting.current = false;
    const message = checked();
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      setLocalError(NM.copyFailed);
      return;
    }
    if (await run("PATCH", path, { action: "send", message })) setNotice("Message copied and marked as sent.");
  }

  function openWhatsApp(e: MouseEvent<HTMLAnchorElement>) {
    acting.current = false;
    const message = checked();
    if (!message || pending) {
      e.preventDefault();
      return;
    }
    void run("PATCH", path, { action: "send", message }).then((ok) => ok && setNotice("WhatsApp opened and marked as sent."));
  }

  async function dismiss() {
    acting.current = false;
    setLocalError(null);
    if (await run("PATCH", path, { action: "dismiss" })) setNotice("Notification dismissed.");
  }

  const onPointerDown = () => { acting.current = true; };
  const actionProps = { onPointerDown, disabled: pending };

  return (
    <div className="mt-3 space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        Message <span className="font-normal text-muted">(you can edit it before sending)</span>
      </label>
      <textarea
        id={id}
        className="input min-h-28 w-full"
        value={text}
        maxLength={MESSAGE_MAX}
        readOnly={!hydrated}
        onChange={(e) => { setText(e.target.value); setNotice(null); }}
        onFocus={() => { acting.current = false; }}
        onBlur={save}
        aria-invalid={localError && localError !== NM.copyFailed ? true : undefined}
        aria-describedby={`${id}-count ${id}-feedback`}
      />
      <p id={`${id}-count`} className="text-right text-xs text-muted tabular-nums">{text.length}/{MESSAGE_MAX}</p>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={copy} {...actionProps}>
          Copy message
        </button>
        <a
          href={waLink(notification.phone, text.trim())}
          target="_blank"
          rel="noopener noreferrer"
          className={`btn-secondary px-3 py-1.5 text-sm ${pending ? "pointer-events-none opacity-60" : ""}`}
          onClick={openWhatsApp}
          aria-disabled={pending || undefined}
          onPointerDown={onPointerDown}
        >
          Open WhatsApp<span className="sr-only"> (opens in a new tab)</span>
        </a>
        <button type="button" className="btn-secondary px-3 py-1.5 text-sm" onClick={dismiss} {...actionProps}>
          Dismiss<span className="sr-only">: message to {notification.recipient_name}</span>
        </button>
      </div>

      <p id={`${id}-feedback`} role="status" aria-live="polite" className={`text-sm ${shownError ? "text-danger" : "text-success"}`}>
        {sending ? "Saving…" : (shownError ?? notice ?? "")}
      </p>
    </div>
  );
}
