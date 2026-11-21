"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { logout } from "@/lib/auth/actions";
import { ActiveNavLinks, NavLinks } from "./NavLinks";
import { Icon } from "./icons";
import { useDrawerFocus } from "./useDrawerFocus";

const SIDEBAR_ID = "app-sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useDrawerFocus({ open, panelRef, toggleRef, onClose: close });

  // Leaving the mobile breakpoint while open: close so the page is not scroll-locked.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 64rem)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:shadow">
        Skip to content
      </a>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden">
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={SIDEBAR_ID}
          className="-ml-2 rounded-md p-2 text-foreground hover:bg-surface-muted"
        >
          <Icon name={open ? "close" : "menu"} />
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>
        <span className="font-semibold">IIMF</span>
      </header>

      {/* Backdrop (mobile only) */}
      {open && <div className="fixed inset-0 z-30 bg-foreground/40 lg:hidden" onClick={close} aria-hidden="true" />}

      <aside
        id={SIDEBAR_ID}
        ref={panelRef}
        aria-label="Main navigation"
        // Visibility switches instantly on open (so focus() can land inside the drawer)
        // and only transitions on close (so the slide-out animation stays visible).
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface duration-200 lg:visible lg:translate-x-0 ${
          open ? "visible translate-x-0 transition-[translate]" : "invisible -translate-x-full transition-[translate,visibility]"
        }`}
      >
        <div className="flex h-14 items-center justify-between px-5 lg:h-16">
          <span className="text-lg font-semibold tracking-tight">
            IIMF <span className="sr-only">— Instituto de Inglês Margarida Freitas</span>
          </span>
          <button type="button" onClick={close} className="rounded-md p-2 text-muted hover:bg-surface-muted lg:hidden">
            <Icon name="close" />
            <span className="sr-only">Close menu</span>
          </button>
        </div>

        <nav aria-label="Sections" className="flex-1 overflow-y-auto px-3 py-2">
          <Suspense fallback={<NavLinks activePath={null} onNavigate={close} />}>
            <ActiveNavLinks onNavigate={close} />
          </Suspense>
        </nav>

        <form action={logout} className="border-t border-border p-3">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <Icon name="logout" />
            Log out
          </button>
        </form>
      </aside>

      <main id="main" tabIndex={-1} className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
