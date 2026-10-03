import {
  Activity, AlertOctagon, AlertTriangle, Archive, BarChart3, Bug, Building2,
  CalendarCheck, CheckSquare, ClipboardList, Clock, FileBarChart, FileText,
  FlaskConical, Folder, Gauge, GitBranch, KeyRound, LayoutDashboard, LifeBuoy,
  ListChecks, Layers, MessageCircle, Plus, RotateCcw, Settings, Shield, ShieldCheck,
  SlidersHorizontal, Timer,
  TrendingUp, UserCog, UserPlus, Users, type LucideIcon,
} from "lucide-react";
import type { SidebarCounts } from "@/types";

/* ---- NAVIGATION AS DATA (spec 16, 17) ----
   The whole sidebar is this structure plus one renderer: grouping, role
   filtering, search, favourites and badges all read from here. Adding a screen
   is a line in this file. */

export interface NavItem {
  label: string;
  to: string;
  icon?: LucideIcon;
  /** Any one of these permits the item. Omit to show for every signed-in user. */
  permissions?: string[];
  /** Key into the sidebar counts payload. Only a few items get a badge --
      spec 17.6 warns against a counter on every menu. */
  badge?: keyof SidebarCounts;
  /** Render the badge in a warning tone rather than neutral. */
  badgeTone?: "default" | "warning" | "danger";
  /** Highlight as a create action. */
  emphasis?: boolean;
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  /** Stable id for remembering the expanded state (spec 17.2). */
  id: string;
  items: NavItem[];
  permissions?: string[];
}

export interface NavSection {
  /** Section caption, e.g. MAIN or BUG MANAGEMENT (spec 17.1). */
  label: string;
  groups: NavGroup[];
}

export const NAVIGATION: NavSection[] = [
  {
    label: "WORKSPACE",
    groups: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        items: [{ label: "Dashboard", to: "/dashboard", icon: LayoutDashboard }],
      },
      {
        id: "chat",
        label: "Chat",
        icon: MessageCircle,
        permissions: ["tickets.ticket.view"],
        items: [{ label: "Chat", to: "/chat", icon: MessageCircle, badge: "chat_unread" }],
      },
    ],
  },
  {
    label: "TICKET CREATION",
    groups: [
      {
        id: "ticket-creation",
        label: "Ticket Creation",
        icon: Plus,
        permissions: ["tickets.ticket.view"],
        items: [
          { label: "Unassigned Tickets", to: "/tickets/unassigned", icon: UserPlus,
            permissions: ["tickets.ticket.view"], badge: "unassigned", badgeTone: "warning" },
          { label: "ReAssign Tickets", to: "/tickets/reassign", icon: UserCog,
            permissions: ["tickets.ticket.reassign"] },
        ],
      },
    ],
  },
  {
    label: "TICKET MANAGEMENT",
    groups: [
      {
        id: "tickets",
        label: "Ticket Management",
        icon: LifeBuoy,
        permissions: ["tickets.ticket.view"],
        items: [
          { label: "All Tickets", to: "/tickets", icon: LifeBuoy },
          { label: "Bug Requests", to: "/tickets/bugs", icon: Bug },
          { label: "Service Requests", to: "/tickets/services", icon: ClipboardList },
          { label: "Access Requests", to: "/tickets/access", icon: KeyRound },
          { label: "Critical Tickets", to: "/tickets/critical", icon: AlertOctagon,
            badge: "critical", badgeTone: "danger" },
          { label: "Overdue Tickets", to: "/tickets/overdue", icon: AlertTriangle,
            badge: "overdue", badgeTone: "danger" },
          { label: "Testing / Verification", to: "/tickets/testing", icon: FlaskConical,
            badge: "testing" },
          { label: "Closed Tickets", to: "/tickets/closed", icon: Archive },
        ],
      },
    ],
  },
  {
    label: "DAILY WORK",
    groups: [
      {
        id: "daily",
        label: "Daily Updates",
        icon: CalendarCheck,
        permissions: ["bugs.update.view"],
        items: [
          { label: "Daily Updates", to: "/updates/today", icon: CalendarCheck,
            badge: "update_pending", badgeTone: "warning" },
        ],
      },
    ],
  },
  {
    label: "REPORTING",
    groups: [
      {
        id: "reports",
        label: "Reports",
        icon: BarChart3,
        permissions: ["reports.report.view"],
        items: [
          { label: "Daily Bug Report", to: "/reports/daily", icon: FileBarChart },
          { label: "Employee Wise", to: "/reports/employee", icon: Users },
          { label: "Project Wise", to: "/reports/project", icon: Folder },
          { label: "Module Wise", to: "/reports/module", icon: Layers },
          { label: "Priority Wise", to: "/reports/priority", icon: SlidersHorizontal },
          { label: "Aging Report", to: "/reports/aging", icon: Clock },
          { label: "Overdue Report", to: "/reports/overdue", icon: AlertTriangle },
          { label: "Closure Report", to: "/reports/closure", icon: TrendingUp },
          { label: "Root Cause Analysis", to: "/reports/root-cause", icon: Activity },
        ],
      },
    ],
  },
  {
    label: "SETTINGS",
    groups: [
      {
        id: "masters",
        label: "Masters",
        icon: Settings,
        permissions: ["masters.master.view"],
        items: [
          { label: "Project", to: "/masters/projects", icon: Folder },
          { label: "Module", to: "/masters/modules", icon: Layers },
          { label: "Submodule", to: "/masters/submodules", icon: GitBranch },
          { label: "Priority", to: "/masters/priorities", icon: SlidersHorizontal },
          { label: "Severity", to: "/masters/severities", icon: AlertOctagon },
          { label: "Root Cause Type", to: "/masters/root-cause-types", icon: Activity },
          { label: "Department", to: "/masters/departments", icon: Building2 },
          { label: "Team", to: "/masters/teams", icon: Users },
          { label: "Site", to: "/masters/sites", icon: Building2 },
        ],
      },
    ],
  },
  {
    label: "ADMINISTRATION",
    groups: [
      {
        id: "administration",
        label: "Administration",
        icon: Shield,
        permissions: ["admin.user.view", "admin.role.view", "admin.audit.view"],
        items: [
          { label: "User Management", to: "/admin/users", icon: UserCog,
            permissions: ["admin.user.view"] },
          { label: "Role Management", to: "/admin/roles", icon: ShieldCheck,
            permissions: ["admin.role.view"] },
          { label: "Permission Management", to: "/admin/permissions", icon: Shield,
            permissions: ["admin.permission.view"] },
          { label: "Audit Log", to: "/admin/audit", icon: FileText,
            permissions: ["admin.audit.view"] },
        ],
      },
    ],
  },
];

/* ---- ROLE-BASED FILTERING (spec 17.8) ----
   The sidebar is generated from permissions, not hardcoded per role. Hiding a
   menu is a convenience only: the backend enforces the same rules
   independently (spec 14). */
export function filterNavigation(
  sections: NavSection[],
  can: (permission: string) => boolean,
): NavSection[] {
  const allowed = (permissions?: string[]) =>
    !permissions || permissions.length === 0 || permissions.some(can);

  return sections
    .map((section) => ({
      ...section,
      groups: section.groups
        .filter((group) => allowed(group.permissions))
        .map((group) => ({ ...group, items: group.items.filter((i) => allowed(i.permissions)) }))
        .filter((group) => group.items.length > 0),
    }))
    .filter((section) => section.groups.length > 0);
}

/** Flat list for the menu search (spec 17.4). */
export function flattenNavigation(sections: NavSection[]): (NavItem & { group: string })[] {
  return sections.flatMap((section) =>
    section.groups.flatMap((group) =>
      group.items.map((item) => ({ ...item, group: group.label })),
    ),
  );
}
