"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActivePath } from "@/lib/navigation";
import { Icon } from "./icons";

type NavLinksProps = { activePath: string | null; onNavigate?: () => void };

/** Presentational list of the 6 sections; `activePath` drives the highlight. */
export function NavLinks({ activePath, onNavigate }: NavLinksProps) {
  return (
    <ul className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = isActivePath(activePath, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-white shadow-sm shadow-black/30"
                  : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
              }`}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Reads the current path. With cacheComponents, usePathname suspends on routes
 * with unknown dynamic params, so callers wrap this in <Suspense> with a
 * <NavLinks activePath={null} /> fallback.
 */
export function ActiveNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return <NavLinks activePath={usePathname()} onNavigate={onNavigate} />;
}
