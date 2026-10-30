import {
  Home,
  MessageCircle,
  Users,
  KanbanSquare,
  Mail,
  BarChart3,
  Settings,
  Menu,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; hint?: string };
export type NavGroup = { label: string; items: NavItem[] };
export type NavCounts = { contacts?: number; dialer?: number; messages?: number; notes?: number; insights?: number };

// Desktop primary (always visible): Today · Contacts · Messages · Pipeline.
// Mobile keeps five tab slots: Today · Contacts · Messages · Pipeline · More.
export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Today", icon: Home },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
];

export const MORE_NAV_ITEMS: NavItem[] = [
  { href: "/sequences", label: "Campaigns", icon: Mail, hint: "Email and text campaigns" },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const MOBILE_MORE_ITEMS: NavItem[] = [...MORE_NAV_ITEMS];

export const NAV_GROUPS: NavGroup[] = [
  { label: "Work", items: PRIMARY_NAV_ITEMS },
  { label: "More", items: MORE_NAV_ITEMS },
];

export type MobileNavItem = { kind: "link"; href: string; label: string; icon: LucideIcon } | { kind: "more"; label: string; icon: LucideIcon };

export const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { kind: "link", href: "/", label: "Today", icon: Home },
  { kind: "link", href: "/contacts", label: "Contacts", icon: Users },
  { kind: "link", href: "/messages", label: "Messages", icon: MessageCircle },
  { kind: "link", href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { kind: "more", label: "More", icon: Menu },
];

export function isPrimaryNavHref(href: string): boolean {
  if (href.startsWith("/?")) return false;
  const path = href.split("?")[0] ?? href;
  return PRIMARY_NAV_ITEMS.some((item) => item.href === path);
}

/** Desktop More: flat list, never re-lists a primary destination. */
export function moreNavItemsForSidebar(): NavItem[] {
  return MORE_NAV_ITEMS.filter((item) => !isPrimaryNavHref(item.href));
}

/** Mobile More sheet: Events + the desktop More list. Lists is not a nav item. */
export function moreNavItemsForSheet(): NavItem[] {
  return MOBILE_MORE_ITEMS.filter((item) => item.href !== "/" && item.href !== "/contacts" && item.href !== "/messages" && item.href !== "/pipeline");
}

export function navItemIsActive(href: string, pathname: string, focus?: string | null): boolean {
  if (href === "/?focus=tasks") return pathname === "/" && focus === "tasks";
  if (href === "/") return pathname === "/";
  if (href.startsWith("/?")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isMorePath(pathname: string): boolean {
  return moreNavItemsForSheet().some((item) => {
    if (item.href.startsWith("/?")) return false;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  });
}
