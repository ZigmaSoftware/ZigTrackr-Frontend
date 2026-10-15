/**
 * Shared bug-detail columns for report drill-down tables.
 *
 * Every drill-down (employee, project, module, priority, aging, closure,
 * root-cause) renders the same bug table: these columns are defined once
 * and imported by each config that needs them (spec 3).
 */

import type { Column } from "@/components/tables/DataTable";
import { TruncatedCell } from "@/components/tables/DataTable";
import {
  AgeCell,
  OverdueBadge,
  PriorityBadge,
  StatusBadge,
} from "@/components/common/badges";
import { formatDate } from "@/lib/dates";
import type { BugListRow } from "@/types";

export const BUG_COLUMNS: Column<BugListRow>[] = [
  {
    key: "bug_no",
    header: "Bug No",
    width: "w-28",
    cell: (row) => (
      <span className="font-medium text-[var(--primary)]">{row.bug_no}</span>
    ),
  },
  {
    key: "title",
    header: "Title",
    cell: (row) => <TruncatedCell>{row.title}</TruncatedCell>,
  },
  {
    key: "status",
    header: "Status",
    width: "w-32",
    cell: (row) => <StatusBadge status={row.status} label={row.status_label} />,
  },
  {
    key: "priority",
    header: "Priority",
    width: "w-28",
    cell: (row) =>
      row.priority ? (
        <PriorityBadge code={row.priority.code} label={row.priority.name} />
      ) : (
        <span className="text-[var(--muted-foreground)]">—</span>
      ),
  },
  {
    key: "owner",
    header: "Owner",
    width: "w-32",
    hideBelow: "md",
    cell: (row) => (
      <span className="text-[13px]">{row.owner?.name ?? "Unassigned"}</span>
    ),
  },
  {
    key: "project",
    header: "Project",
    width: "w-32",
    hideBelow: "lg",
    cell: (row) => (
      <span className="text-[13px]">{row.project?.name ?? "—"}</span>
    ),
  },
  {
    key: "age_days",
    header: "Age",
    width: "w-20",
    align: "right",
    hideBelow: "md",
    cell: (row) => <AgeCell days={row.age_days} band={row.aging_band} />,
  },
  {
    key: "overdue_days",
    header: "Overdue",
    width: "w-24",
    align: "right",
    hideBelow: "md",
    cell: (row) =>
      row.is_overdue ? (
        <OverdueBadge days={row.overdue_days} />
      ) : (
        <span className="text-[var(--muted-foreground)]">—</span>
      ),
  },
  {
    key: "expected_closure_date",
    header: "Expected",
    width: "w-28",
    align: "right",
    hideBelow: "lg",
    optional: true,
    cell: (row) => (
      <span className="text-[13px] tabular-nums">
        {row.expected_closure_date ? formatDate(row.expected_closure_date) : "—"}
      </span>
    ),
  },
];

/** Leaner column set for closure and root-cause drill-downs. */
export const CLOSURE_BUG_COLUMNS: Column<BugListRow>[] = [
  BUG_COLUMNS[0], // bug_no
  BUG_COLUMNS[1], // title
  BUG_COLUMNS[2], // status
  BUG_COLUMNS[4], // owner
  {
    key: "root_cause",
    header: "Root Cause",
    hideBelow: "lg",
    cell: (row) => {
      // BugListRow doesn't carry root_cause directly; drill-down from
      // closure/root-cause pages passes extended rows.
      const rc = (row as unknown as Record<string, unknown>).root_cause_type;
      const name = rc && typeof rc === "object" ? (rc as { name?: string }).name : null;
      return <span className="text-[13px]">{name ?? "—"}</span>;
    },
  },
  {
    key: "closed_date",
    header: "Closed",
    width: "w-28",
    align: "right",
    cell: (row) => {
      const d = (row as unknown as Record<string, unknown>).closed_date as string | null;
      return (
        <span className="text-[13px] tabular-nums">
          {d ? formatDate(d) : "—"}
        </span>
      );
    },
  },
];
