"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Options = {
  open: boolean;
  panelRef: RefObject<HTMLElement | null>;
  toggleRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
};

/**
 * Keyboard behaviour of the mobile drawer: moves focus into it when opened,
 * traps Tab inside, closes on Escape, locks page scroll and returns focus to
 * the menu button when closed.
 */
export function useDrawerFocus({ open, panelRef, toggleRef, onClose }: Options) {
  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;

    const focusables = () => Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    focusables()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    const toggle = toggleRef.current;

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      // Only return focus if it is still inside the drawer (not after a link navigated away).
      if (panel.contains(document.activeElement) || document.activeElement === document.body) {
        toggle?.focus();
      }
    };
  }, [open, panelRef, toggleRef, onClose]);
}
