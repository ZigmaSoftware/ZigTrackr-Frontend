import type { BugStatus } from "@/types";

/* ---- ONE LIST, NINE ROUTES (spec 18) ----
   Spec 18 is explicit that "Assigned to Me", "Overdue", "Critical", "Testing"
   and "Closed" must be filtered views of the same bug data, not duplicate
   pages with their own logic. Each entry here is only a preset filter plus
   presentation; BugListPage does the rest. */

export interface BugPreset {
  key: string;
  title: string;
  description: string;
  /** Query parameters merged into the request, not shown as removable chips. */
  filters: Record<string, unknown>;
  /** Default sort for this view. */
  ordering?: string;
  emptyTitle: string;
  emptyDescription: string;
  /** Columns worth surfacing for this particular view. */
  extraColumns?: string[];
}

export const BUG_PRESETS: Record<string, BugPreset> = {
  all: {
    key: "all",
    title: "All Bugs",
    description: "Every bug you have access to.",
    filters: {},
    emptyTitle: "No bugs found",
    emptyDescription: "Nothing matches the current filters. Try clearing them.",
  },
  mine: {
    key: "mine",
    title: "My Bugs",
    description: "Bugs you reported.",
    filters: { reporter: "me" },
    emptyTitle: "You have not reported any bugs",
    emptyDescription: "Bugs you raise will appear here.",
  },
  assigned: {
    key: "assigned",
    title: "Assigned to Me",
    description: "Bugs you own.",
    filters: { owner: "me", exclude_status: ["CLOSED", "REJECTED"] },
    ordering: "-priority__rank",
    emptyTitle: "Nothing assigned to you",
    emptyDescription: "You have no open bugs. Enjoy the quiet.",
  },
  unassigned: {
    key: "unassigned",
    title: "Unassigned Bugs",
    description: "Waiting for an owner.",
    filters: { unassigned: true, exclude_status: ["CLOSED", "REJECTED"] },
    ordering: "reported_date",
    emptyTitle: "Everything is assigned",
    emptyDescription: "No bug is currently waiting for an owner.",
  },
  critical: {
    key: "critical",
    title: "Critical Bugs",
    description: "Highest business urgency.",
    filters: { priority: "CRITICAL", exclude_status: ["CLOSED", "REJECTED"] },
    emptyTitle: "No critical bugs",
    emptyDescription: "Nothing critical is currently open.",
  },
  overdue: {
    key: "overdue",
    title: "Overdue Bugs",
    description: "Past their expected closure date.",
    filters: { is_overdue: true },
    ordering: "-overdue_days",
    emptyTitle: "No overdue bugs 🎉",
    emptyDescription: "All active bugs are within their expected closure date.",
    extraColumns: ["overdue_days"],
  },
  testing: {
    key: "testing",
    title: "Testing / Verification",
    description: "Awaiting QA verification.",
    filters: { status: ["TESTING"] },
    emptyTitle: "Nothing in testing",
    emptyDescription: "No bug is currently awaiting verification.",
  },
  reopened: {
    key: "reopened",
    title: "Reopened Bugs",
    description: "Closed once, then reopened.",
    filters: { reopened: true },
    ordering: "-last_reopened_at",
    emptyTitle: "No reopened bugs",
    emptyDescription: "Nothing has needed reopening.",
    extraColumns: ["reopen_count"],
  },
  closed: {
    key: "closed",
    title: "Closed Bugs",
    description: "Completed and verified.",
    filters: { status: ["CLOSED"] },
    ordering: "-closed_date",
    emptyTitle: "No closed bugs yet",
    emptyDescription: "Closed bugs will be listed here.",
  },
  "update-pending": {
    key: "update-pending",
    title: "Update Pending",
    description: "Active bugs with no update today.",
    filters: { is_update_pending: true },
    ordering: "-days_since_update",
    emptyTitle: "Everyone is up to date 🎉",
    emptyDescription: "Every active bug has today's update.",
    extraColumns: ["days_since_update"],
  },
  "daily-updates": {
    key: "daily-updates",
    title: "Daily Updates",
    description: "Updates recorded today across the bugs you can access.",
    filters: { updated_today: true },
    ordering: "-latest_update_at",
    emptyTitle: "No updates today",
    emptyDescription: "Daily updates added today will appear here.",
  },
};

export const STATUS_OPTIONS: { value: BugStatus; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "TESTING", label: "Testing / Verification" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
  { value: "REOPENED", label: "Reopened" },
  { value: "REJECTED", label: "Rejected / Not a Bug" },
];

export const ENVIRONMENT_OPTIONS = [
  { value: "PRODUCTION", label: "Production" },
  { value: "UAT", label: "UAT" },
  { value: "STAGING", label: "Staging" },
  { value: "DEVELOPMENT", label: "Development" },
  { value: "LOCAL", label: "Local" },
];
