import { Card, CardBody } from "@/components/ui/primitives";
import type { ReportConfig } from "@/features/reports/ReportShell";
import type { Column } from "@/components/tables/DataTable";

/* Spec 33-36: the nine reports, each a config over the shared shell. */

type Row = Record<string, unknown>;

const num = (key: string, header: string): Column<Row> => ({
  key, header, align: "right", width: "w-24",
  cell: (row) => <span className="tabular-nums">{String(row[key] ?? 0)}</span>,
});

const text = (key: string, header: string): Column<Row> => ({
  key, header, cell: (row) => <span className="font-medium">{String(row[key] ?? "—")}</span>,
});

function SummaryGrid({ items }: { items: { label: string; value: unknown; tone?: string }[] }) {
  return (
    <Card>
      <CardBody className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        {items.map((item) => (
          <div key={item.label}>
            <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
              {item.label}
            </p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${item.tone ?? ""}`}>
              {String(item.value ?? 0)}
            </p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

export const REPORT_CONFIGS: Record<string, ReportConfig<Row>> = {
  daily: {
    name: "daily", title: "Daily Bug Report",
    description: "Opening + New − Closed = Closing.",
    filters: ["date"],
    renderSummary: (data) => {
      const d = (data ?? {}) as Row;
      return (
        <SummaryGrid items={[
          { label: "Opening", value: d.opening_bugs },
          { label: "New", value: d.new_bugs },
          { label: "Closed", value: d.closed_bugs },
          { label: "Closing", value: d.closing_bugs },
          { label: "Reopened", value: d.reopened },
          { label: "Overdue", value: d.overdue, tone: "text-[var(--destructive)]" },
        ]} />
      );
    },
  },
  employee: {
    name: "employee", title: "Employee Wise Report",
    description: "Workload per developer. Use for balancing, not for scoring individuals.",
    columns: [
      text("name", "Developer"),
      num("assigned", "Assigned"), num("in_progress", "In Progress"),
      num("testing", "Testing"), num("closed", "Closed"),
      num("overdue", "Overdue"), num("update_pending", "No Update"),
      num("total_open", "Open"),
    ],
  },
  project: {
    name: "project", title: "Project Wise Report",
    description: "Bug distribution across projects.",
    columns: [
      text("name", "Project"), num("total", "Total"), num("open", "Open"),
      num("closed", "Closed"), num("overdue", "Overdue"), num("critical", "Critical"),
    ],
  },
  module: {
    name: "module", title: "Module Wise Report",
    description: "Which modules generate the most issues.",
    columns: [
      text("name", "Module"),
      { key: "project", header: "Project",
        cell: (row) => <span className="text-[var(--muted-foreground)]">{String(row.project ?? "—")}</span> },
      num("total", "Total"), num("open", "Open"), num("closed", "Closed"),
    ],
  },
  priority: {
    name: "priority", title: "Priority Wise Report",
    description: "Distribution by business urgency.",
    columns: [
      text("name", "Priority"), num("total", "Total"), num("open", "Open"),
      num("closed", "Closed"), num("overdue", "Overdue"),
    ],
  },
  aging: {
    name: "aging", title: "Aging Report",
    description: "How long open bugs have been waiting.",
    selectRows: (data) => ((data as Row)?.summary as Row[]) ?? [],
    renderSummary: (data) => {
      const d = (data ?? {}) as Row;
      return <SummaryGrid items={[
        { label: "Total open", value: d.total_open },
        { label: "Average age (days)", value: d.average_age },
      ]} />;
    },
    columns: [text("label", "Band"), num("count", "Bugs")],
  },
  overdue: {
    name: "overdue", title: "Overdue Report",
    description: "Bugs past their expected closure date.",
    selectRows: (data) => ((data as Row)?.bugs as Row[]) ?? [],
    renderSummary: (data) => {
      const d = (data ?? {}) as Row;
      return <SummaryGrid items={[
        { label: "Overdue bugs", value: d.count, tone: "text-[var(--destructive)]" },
        { label: "Total overdue days", value: d.total_overdue_days },
      ]} />;
    },
    columns: [
      { key: "bug_no", header: "Bug No", width: "w-32",
        cell: (row) => <span className="font-medium text-[var(--primary)]">{String(row.bug_no)}</span> },
      text("title", "Title"),
      { key: "owner", header: "Owner",
        cell: (row) => <span>{(row.owner as Row | null)?.name as string ?? "Unassigned"}</span> },
      num("overdue_days", "Days Late"),
    ],
  },
  closure: {
    name: "closure", title: "Closure Report",
    description: "Closures over a period, and who closed them.",
    filters: ["dateRange"],
    selectRows: (data) => ((data as Row)?.by_user as Row[]) ?? [],
    renderSummary: (data) => {
      const d = (data ?? {}) as Row;
      return <SummaryGrid items={[
        { label: "Total closed", value: d.total_closed },
        { label: "Avg closure (days)", value: d.avg_closure_days },
      ]} />;
    },
    columns: [text("name", "Closed by"), num("count", "Bugs closed")],
  },
  "root-cause": {
    name: "root-cause", title: "Root Cause Analysis",
    description: "Where bugs actually come from.",
    columns: [
      text("name", "Root cause"),
      num("count", "Bugs"),
      { key: "percentage", header: "Share", align: "right", width: "w-40",
        cell: (row) => (
          <div className="flex items-center justify-end gap-2">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--muted)]">
              <div className="h-full rounded-full bg-[var(--chart-1)]"
                   style={{ width: `${Number(row.percentage ?? 0)}%` }} />
            </div>
            <span className="w-11 text-right tabular-nums">{String(row.percentage)}%</span>
          </div>
        ) },
    ],
  },
};
