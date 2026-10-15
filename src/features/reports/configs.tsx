import type { ReactNode } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardBody } from "@/components/ui/primitives";
import { DataTable, TruncatedCell } from "@/components/tables/DataTable";
import type { Column } from "@/components/tables/DataTable";
import {
  AgeCell, OverdueBadge, PriorityBadge, StatusBadge,
} from "@/components/common/badges";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { BUG_COLUMNS, CLOSURE_BUG_COLUMNS } from "./bugColumns";
import type { ReportConfig, DrilldownRequest } from "./ReportShell";
import type { DrilldownParams } from "./DrilldownDrawer";
import type { BugListRow, BugStatus, AgingBand } from "@/types";

/** Status values that represent terminal/closed states — excluded from "open" drill-downs. */
const EXCLUDE_CLOSED: string[] = ["CLOSED", "REJECTED"];

/* ---- Shared types & helpers ---- */

type Row = Record<string, unknown>;

/* Hard-coded hex values — CSS custom properties don't resolve inside SVG,
   so Recharts Cell fills must use literal colours. */
const CHART_COLORS = [
  "#7762e8", // violet
  "#f18576", // coral
  "#23b8a6", // teal
  "#5d9cec", // blue
  "#c4a2ed", // lavender
  "#f5a623", // amber
  "#e8507a", // rose
  "#34c9a0", // mint
];

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  fontSize: 12,
};

const num = (key: string, header: string, tone?: string): Column<Row> => ({
  key, header, align: "right", width: "w-24",
  cell: (row) => (
    <span className={cn("tabular-nums", tone)}>
      {String(row[key] ?? 0)}
    </span>
  ),
});

const text = (key: string, header: string): Column<Row> => ({
  key, header,
  cell: (row) => <span className="font-medium">{String(row[key] ?? "—")}</span>,
});

/* ---- Clickable Summary Grid ---- */

interface SummaryItem {
  label: string;
  value: unknown;
  tone?: string;
  onClick?: () => void;
}

function SummaryGrid({ items }: { items: SummaryItem[] }) {
  return (
    <Card>
      <CardBody className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        {items.map((item) => {
          const Wrapper = item.onClick ? "button" : "div";
          return (
            <Wrapper
              key={item.label}
              type={item.onClick ? "button" : undefined}
              onClick={item.onClick}
              className={cn(
                "rounded-lg p-2 text-left transition-colors",
                item.onClick && "cursor-pointer hover:bg-[var(--muted)]/60",
              )}
            >
              <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
                {item.label}
              </p>
              <p className={cn("mt-1 text-xl font-semibold tabular-nums", item.tone)}>
                {String(item.value ?? 0)}
              </p>
            </Wrapper>
          );
        })}
      </CardBody>
    </Card>
  );
}

/* ---- Chart wrapper for consistent card + padding ---- */

function ChartCard({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <Card>
      {title ? (
        <div className="border-b border-[var(--border)] px-5 py-3">
          <p className="text-[13px] font-medium text-[var(--muted-foreground)]">{title}</p>
        </div>
      ) : null}
      <CardBody className="h-[260px]">{children}</CardBody>
    </Card>
  );
}

/* ---- Bug-detail table for reports that embed a bug list ---- */

function BugTable({ bugs }: { bugs: BugListRow[] }) {
  if (!bugs?.length) return null;
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <p className="text-[13px] font-medium text-[var(--muted-foreground)]">
          Bug details — {bugs.length} {bugs.length === 1 ? "bug" : "bugs"}
        </p>
      </div>
      <DataTable<BugListRow>
        columns={BUG_COLUMNS}
        rows={bugs}
        rowKey={(row) => row.id ?? row.bug_no}
        emptyTitle="No bugs"
      />
    </Card>
  );
}

/* ================================================================
   THE NINE REPORT CONFIGS
   ================================================================ */

/* ---- 1. DAILY BUG REPORT ---- */
const dailyConfig: ReportConfig<Row> = {
  name: "daily",
  title: "Daily Bug Report",
  description: "Opening + New − Closed = Closing. Click a metric to drill down.",
  filters: ["date"],
  renderSummary: (data, onDrilldown) => {
    const d = (data ?? {}) as Row;
    const date = d.report_date as string | undefined;

    const drill = (label: string, params: DrilldownParams) => () =>
      onDrilldown({ title: `${label} — ${date ?? "today"}`, params });

    return (
      <>
        <SummaryGrid items={[
          { label: "Opening", value: d.opening_bugs,
            onClick: date ? drill("Opening bugs", { reported_to: date, exclude_status: EXCLUDE_CLOSED }) : undefined },
          { label: "New", value: d.new_bugs,
            onClick: date ? drill("New bugs", { reported_from: date, reported_to: date }) : undefined },
          { label: "Closed", value: d.closed_bugs,
            onClick: date ? drill("Closed bugs", { closed_from: date, closed_to: date }) : undefined },
          { label: "Closing", value: d.closing_bugs },
          { label: "Reopened", value: d.reopened },
          { label: "Overdue", value: d.overdue, tone: "text-[var(--destructive)]",
            onClick: drill("Overdue bugs", { is_overdue: "true" }) },
          { label: "Critical", value: d.critical, tone: "text-[var(--priority-critical-fg)]",
            onClick: drill("Critical bugs", { priority: "CRITICAL", exclude_status: EXCLUDE_CLOSED }) },
          { label: "No Update", value: d.update_pending, tone: "text-[var(--priority-medium-fg)]",
            onClick: drill("Pending update", { is_update_pending: "true" }) },
        ]} />
        {(d.bugs as BugListRow[])?.length ? (
          <div className="mt-4">
            <BugTable bugs={d.bugs as BugListRow[]} />
          </div>
        ) : null}
      </>
    );
  },
  renderChart: (data) => {
    const d = (data ?? {}) as Row;
    const chartData = [
      { name: "Opening", value: Number(d.opening_bugs ?? 0) },
      { name: "New", value: Number(d.new_bugs ?? 0) },
      { name: "Closed", value: Number(d.closed_bugs ?? 0) },
      { name: "Reopened", value: Number(d.reopened ?? 0) },
      { name: "Overdue", value: Number(d.overdue ?? 0) },
    ].filter((d) => d.value > 0);
    if (!chartData.length) return null;
    return (
      <ChartCard title="Daily breakdown">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
            <ChartTooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  },
};

/* ---- 2. EMPLOYEE WISE REPORT ---- */
const employeeConfig: ReportConfig<Row> = {
  name: "employee",
  title: "Employee Wise Report",
  description: "Workload per developer. Click a row to see their bugs.",
  columns: [
    text("name", "Developer"),
    num("assigned", "Assigned"),
    num("in_progress", "In Progress"),
    num("testing", "Testing"),
    num("closed", "Closed"),
    num("overdue", "Overdue", "text-[var(--destructive)]"),
    num("update_pending", "No Update", "text-[var(--priority-medium-fg)]"),
    num("critical", "Critical", "text-[var(--priority-critical-fg)]"),
    num("total_open", "Open"),
  ],
  drilldownParams: (row) => {
    const id = row.id as string | undefined;
    if (!id) return null;
    return {
      title: `${row.name ?? "Developer"} — open bugs`,
      description: `${row.total_open ?? 0} open bugs assigned`,
      params: { owner: id, exclude_status: EXCLUDE_CLOSED },
    };
  },
};

/* ---- 3. PROJECT WISE REPORT ---- */
const projectConfig: ReportConfig<Row> = {
  name: "project",
  title: "Project Wise Report",
  description: "Bug distribution across projects. Click a row to drill down.",
  columns: [
    text("name", "Project"),
    num("total", "Total"),
    num("open", "Open"),
    num("closed", "Closed"),
    num("overdue", "Overdue", "text-[var(--destructive)]"),
    num("critical", "Critical", "text-[var(--priority-critical-fg)]"),
  ],
  renderChart: (data) => {
    const rows = (data as Row[] | null) ?? [];
    if (!rows.length) return null;
    const chartData = rows.slice(0, 8).map((r) => ({
      name: String(r.name ?? "—"),
      open: Number(r.open ?? 0),
      closed: Number(r.closed ?? 0),
    }));
    return (
      <ChartCard title="Open vs Closed by project">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 12 }} />
            <ChartTooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="open" name="Open" fill="#f18576" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="closed" name="Closed" fill="#23b8a6" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  },
  drilldownParams: (row) => {
    const id = row.id as string | undefined;
    if (!id) return null;
    return {
      title: `${row.name ?? "Project"} — all bugs`,
      params: { project: id },
    };
  },
};

/* ---- 4. MODULE WISE REPORT ---- */
const moduleConfig: ReportConfig<Row> = {
  name: "module",
  title: "Module Wise Report",
  description: "Which modules generate the most issues. Click a row to drill down.",
  columns: [
    text("name", "Module"),
    { key: "project", header: "Project",
      cell: (row) => <span className="text-[var(--muted-foreground)]">{String(row.project ?? "—")}</span> },
    num("total", "Total"),
    num("open", "Open"),
    num("closed", "Closed"),
  ],
  drilldownParams: (row) => {
    const id = row.id as string | undefined;
    if (!id) return null;
    return {
      title: `${row.name ?? "Module"} — bugs`,
      description: `Project: ${row.project ?? "—"}`,
      params: { module: id },
    };
  },
};

/* ---- 5. PRIORITY WISE REPORT ---- */
const priorityConfig: ReportConfig<Row> = {
  name: "priority",
  title: "Priority Wise Report",
  description: "Distribution by business urgency. Click a row to drill down.",
  columns: [
    {
      key: "name", header: "Priority",
      cell: (row) => row.code ? (
        <PriorityBadge code={row.code as string} label={row.name as string} />
      ) : (
        <span className="font-medium">{String(row.name ?? "—")}</span>
      ),
    },
    num("total", "Total"),
    num("open", "Open"),
    num("closed", "Closed"),
    num("overdue", "Overdue", "text-[var(--destructive)]"),
  ],
  renderChart: (data) => {
    const rows = (data as Row[] | null) ?? [];
    if (!rows.length) return null;
    const chartData = rows.map((r) => ({
      name: String(r.name ?? "—"),
      value: Number(r.total ?? 0),
      color: String(r.color ?? "#5d9cec"),
    })).filter((d) => d.value > 0);
    if (!chartData.length) return null;
    return (
      <ChartCard title="Bug distribution by priority">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius="60%"
              outerRadius="88%"
              paddingAngle={chartData.length > 1 ? 3 : 0}
              cornerRadius={4}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <ChartTooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  },
  drilldownParams: (row) => {
    const code = row.code as string | undefined;
    if (!code) return null;
    return {
      title: `${row.name ?? "Priority"} — open bugs`,
      params: { priority: code, exclude_status: EXCLUDE_CLOSED },
    };
  },
};

/* ---- 6. AGING REPORT ---- */

/* Aging band colours — literal hex, same values as the light-mode CSS vars in index.css */
const AGING_COLORS: Record<string, string> = {
  NORMAL:    "#166534", // green
  ATTENTION: "#854d0e", // amber
  WARNING:   "#9a3412", // orange
  CRITICAL:  "#991b1b", // red
};

const agingConfig: ReportConfig<Row> = {
  name: "aging",
  title: "Aging Report",
  description: "How long open bugs have been waiting. Click a band to drill down.",
  selectRows: (data) => ((data as Row)?.summary as Row[]) ?? [],
  renderSummary: (data) => {
    const d = (data ?? {}) as Row;
    return (
      <SummaryGrid items={[
        { label: "Total open", value: d.total_open },
        { label: "Average age (days)", value: d.average_age },
      ]} />
    );
  },
  renderChart: (data) => {
    const bands = ((data as Row)?.summary as Row[] | null) ?? [];
    if (!bands.length) return null;
    const chartData = bands.map((b) => ({
      name: String(b.label ?? b.code ?? "—"),
      count: Number(b.count ?? 0),
      fill: AGING_COLORS[String(b.code)] ?? "#5d9cec",
    }));
    return (
      <ChartCard title="Open bugs by aging band">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <ChartTooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="count" name="Bugs" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  },
  columns: [
    {
      key: "label", header: "Band",
      cell: (row) => {
        const code = String(row.code ?? "");
        const color = AGING_COLORS[code] ?? "#94a3b8";
        return (
          <span className="flex items-center gap-2 font-medium">
            <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
            {String(row.label ?? "—")}
          </span>
        );
      },
    },
    num("count", "Bugs"),
  ],
  drilldownParams: (row) => {
    const code = row.code as string | undefined;
    if (!code) return null;
    return {
      title: `${row.label ?? "Band"} — open bugs`,
      params: { aging_band: code, exclude_status: EXCLUDE_CLOSED },
    };
  },
};

/* ---- 7. OVERDUE REPORT ---- */
const overdueConfig: ReportConfig<Row> = {
  name: "overdue",
  title: "Overdue Report",
  description: "Bugs past their expected closure date — current status.",
  selectRows: (data) => ((data as Row)?.bugs as Row[]) ?? [],
  renderSummary: (data) => {
    const d = (data ?? {}) as Row;
    return (
      <SummaryGrid items={[
        { label: "Overdue bugs", value: d.count, tone: "text-[var(--destructive)]" },
        { label: "Total overdue days", value: d.total_overdue_days },
      ]} />
    );
  },
  columns: [
    {
      key: "bug_no", header: "Bug No", width: "w-28",
      cell: (row) => (
        <span className="font-medium text-[var(--primary)]">{String(row.bug_no)}</span>
      ),
    },
    {
      key: "title", header: "Title",
      cell: (row) => <TruncatedCell>{String(row.title ?? "")}</TruncatedCell>,
    },
    {
      key: "status", header: "Status", width: "w-32",
      cell: (row) => (
        <StatusBadge status={row.status as BugStatus} label={row.status_label as string | undefined} />
      ),
    },
    {
      key: "priority", header: "Priority", width: "w-28",
      cell: (row) => {
        const p = row.priority as { code: string; name: string } | null;
        return p ? <PriorityBadge code={p.code} label={p.name} /> : <span className="text-[var(--muted-foreground)]">—</span>;
      },
    },
    {
      key: "owner", header: "Owner", width: "w-32",
      cell: (row) => (
        <span className="text-[13px]">{(row.owner as Row | null)?.name as string ?? "Unassigned"}</span>
      ),
    },
    {
      key: "project", header: "Project", width: "w-32", hideBelow: "lg" as const,
      cell: (row) => (
        <span className="text-[13px]">{(row.project as Row | null)?.name as string ?? "—"}</span>
      ),
    },
    {
      key: "age_days", header: "Age", width: "w-20", align: "right" as const, hideBelow: "md" as const,
      cell: (row) => <AgeCell days={row.age_days as number} band={row.aging_band as AgingBand} />,
    },
    {
      key: "overdue_days", header: "Overdue", width: "w-24", align: "right" as const,
      cell: (row) => {
        const days = Number(row.overdue_days ?? 0);
        return days > 0 ? <OverdueBadge days={days} /> : <span className="text-[var(--muted-foreground)]">—</span>;
      },
    },
    {
      key: "expected_closure_date", header: "Expected", width: "w-28", align: "right" as const,
      hideBelow: "md" as const,
      cell: (row) => (
        <span className="text-[13px] tabular-nums">
          {row.expected_closure_date ? formatDate(row.expected_closure_date as string) : "—"}
        </span>
      ),
    },
  ],
};

/* ---- 8. CLOSURE REPORT ---- */
const closureConfig: ReportConfig<Row> = {
  name: "closure",
  title: "Closure Report",
  description: "Closures over a period. Click a user or project row to drill down.",
  filters: ["dateRange"],
  selectRows: (data) => ((data as Row)?.by_user as Row[]) ?? [],
  renderSummary: (data, onDrilldown) => {
    const d = (data ?? {}) as Row;
    const byProject = (d.by_project as Row[] | null) ?? [];

    return (
      <>
        <SummaryGrid items={[
          { label: "Total closed", value: d.total_closed },
          { label: "Avg closure (days)", value: d.avg_closure_days },
          { label: "Date from", value: d.date_from },
          { label: "Date to", value: d.date_to },
        ]} />

        {/* By-project breakdown */}
        {byProject.length > 0 ? (
          <Card className="mt-4 overflow-hidden">
            <div className="border-b border-[var(--border)] px-5 py-3">
              <p className="text-[13px] font-medium text-[var(--muted-foreground)]">
                Closed by project
              </p>
            </div>
            <DataTable<Row>
              columns={[text("name", "Project"), num("count", "Closed")]}
              rows={byProject}
              rowKey={(row, i) => String(row.id ?? i)}
              onRowClick={(row) => {
                const id = row.id as string | undefined;
                if (id) {
                  onDrilldown({
                    title: `${row.name ?? "Project"} — closed bugs`,
                    params: {
                      project: id,
                      status: "CLOSED",
                      ...(d.date_from ? { closed_from: String(d.date_from) } : {}),
                      ...(d.date_to ? { closed_to: String(d.date_to) } : {}),
                    },
                    columns: CLOSURE_BUG_COLUMNS,
                  });
                }
              }}
              emptyTitle="No project data"
            />
          </Card>
        ) : null}

        {/* Embedded bug list */}
        {(d.bugs as BugListRow[])?.length ? (
          <div className="mt-4">
            <BugTable bugs={d.bugs as BugListRow[]} />
          </div>
        ) : null}
      </>
    );
  },
  renderChart: (data) => {
    const byUser = ((data as Row)?.by_user as Row[] | null) ?? [];
    if (!byUser.length) return null;
    const chartData = byUser.slice(0, 10).map((r) => ({
      name: String(r.name ?? "—"),
      count: Number(r.count ?? 0),
    }));
    return (
      <ChartCard title="Closures by user">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
            <ChartTooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="count" name="Closed" fill="#23b8a6" radius={[0, 4, 4, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  },
  columns: [text("name", "Closed by"), num("count", "Bugs closed")],
  // NOTE: BugFilter has no closed_by filter. Clicking a user row shows all
  // closed bugs for the current date range (same as the embedded list).
  // A future backend enhancement could add a closed_by filter to BugFilter.
  drilldownParams: (row) => {
    const id = row.id as string | undefined;
    if (!id) return null;
    return {
      title: `${row.name ?? "User"} — closed bugs`,
      description: `${row.count ?? 0} bugs closed by this user`,
      params: { status: ["CLOSED"] },
      columns: CLOSURE_BUG_COLUMNS,
    };
  },
  drilldownColumns: CLOSURE_BUG_COLUMNS,
};

/* ---- 9. ROOT CAUSE ANALYSIS ---- */
const rootCauseConfig: ReportConfig<Row> = {
  name: "root-cause",
  title: "Root Cause Analysis",
  description: "Where bugs actually come from. Root cause is set when a bug is closed. Click a row to drill down.",
  columns: [
    text("name", "Root cause"),
    num("count", "Bugs"),
    {
      key: "percentage", header: "Share", align: "right", width: "w-40",
      cell: (row) => (
        <div className="flex items-center justify-end gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--muted)]">
            <div
              className="h-full rounded-full bg-[var(--chart-1)]"
              style={{ width: `${Number(row.percentage ?? 0)}%` }}
            />
          </div>
          <span className="w-11 text-right tabular-nums">{String(row.percentage)}%</span>
        </div>
      ),
    },
  ],
  renderChart: (data) => {
    const rows = (data as Row[] | null) ?? [];
    if (!rows.length) return null;
    const chartData = rows.map((r) => ({
      name: String(r.name ?? "—"),
      value: Number(r.count ?? 0),
    })).filter((d) => d.value > 0);
    if (!chartData.length) return null;
    return (
      <ChartCard title="Root cause distribution">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="88%"
              paddingAngle={chartData.length > 1 ? 3 : 0}
              cornerRadius={4}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <ChartTooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  },
  drilldownParams: (row) => {
    const code = row.code as string | undefined;
    if (!code) return null;
    return {
      title: `${row.name ?? "Root cause"} — bugs`,
      params: { root_cause_type: code },
      columns: CLOSURE_BUG_COLUMNS,
    };
  },
  drilldownColumns: CLOSURE_BUG_COLUMNS,
  emptyTitle: "No root cause data yet",
  emptyDescription: "Root cause is recorded when a bug is closed. Once bugs are closed with a root cause selected, they will appear here.",
};

/* ---- EXPORT ---- */

export const REPORT_CONFIGS: Record<string, ReportConfig<Row>> = {
  daily: dailyConfig,
  employee: employeeConfig,
  project: projectConfig,
  module: moduleConfig,
  priority: priorityConfig,
  aging: agingConfig,
  overdue: overdueConfig,
  closure: closureConfig,
  "root-cause": rootCauseConfig,
};
