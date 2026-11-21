// The 6 app sections (SPEC §2.2, §5 "Global layout").
export type NavIcon = "dashboard" | "students" | "schedule" | "attendance" | "payments" | "notifications";
export type NavItem = { href: string; label: string; icon: NavIcon };

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/students", label: "Students", icon: "students" },
  { href: "/schedule", label: "Schedule", icon: "schedule" },
  { href: "/attendance", label: "Attendance", icon: "attendance" },
  { href: "/payments", label: "Payments", icon: "payments" },
  { href: "/notifications", label: "Notifications", icon: "notifications" },
];

/** A section is active on its own path and on any nested path (e.g. /students/123). */
export function isActivePath(pathname: string | null, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
