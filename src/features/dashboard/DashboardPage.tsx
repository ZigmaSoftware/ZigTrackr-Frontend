import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Activity, AlertOctagon, AlertTriangle, Archive, CheckCircle2, Clock,
  FlaskConical, PlayCircle, TrendingUp, UserPlus,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis,
} from "recharts";
import { dashboardApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { useAuth } from "@/features/auth/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/primitives";
import { EmptyState, ErrorState, KpiSkeleton, CardSkeleton } from "@/components/feedback/states";
import { StatusBadge, PriorityBadge, OverdueBadge } from "@/components/common/badges";
import { useCountUp } from "@/hooks/useCountUp";
import { greeting, longDate, relativeTime } from "@/lib/dates";
import type { BugListRow, ChartDatum, DashboardKpis } from "@/types";

const CHART_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)", "var(--chart-6)",
];

export function DashboardPage() {
  const { user } = useAuth();

  const kpis = useQuery({ queryKey: queryKeys.dashboard.kpis, queryFn: dashboardApi.kpis });
  const charts = useQuery({ queryKey: queryKeys.dashboard.charts, queryFn: dashboardApi.charts });
  const attention = useQuery({ queryKey: queryKeys.dashboard.attention, queryFn: dashboardApi.attention });
  const myWork = useQuery({ queryKey: queryKeys.dashboard.myWork, queryFn: dashboardApi.myWork });
  const activity = useQuery({ queryKey: queryKeys.dashboard.activity, queryFn: dashboardApi.recentActivity });

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user?.name?.split(" ")[0] ?? "there"}`}
        description={longDate()}
      />

      {/* ---- KPI CARDS (spec 21.2) ---- */}
      {kpis.isLoading ? (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          {Array.from({ length: 8 }).map((_, index) => <KpiSkeleton key={index} />)}
        </div>
      ) : kpis.isError ? (
        <Card className="mb-4"><ErrorState onRetry={() => kpis.refetch()} /></Card>
      ) : kpis.data ? (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Kpi label="Total Open" value={kpis.data.total_open} icon={Activity} to="/tickets" />
          <Kpi label="Critical" value={kpis.data.critical} icon={AlertOctagon} tone="danger" to="/tickets/critical" />
          <Kpi label="High" value={kpis.data.high} icon={AlertTriangle} tone="warning" />
          <Kpi label="In Progress" value={kpis.data.in_progress} icon={PlayCircle} />
          <Kpi label="Testing" value={kpis.data.testing} icon={FlaskConical} to="/tickets/testing" />
          <Kpi label="Overdue" value={kpis.data.overdue} icon={Clock} tone="danger" to="/tickets/overdue" />
          <Kpi label="Closed Today" value={kpis.data.closed_today} icon={CheckCircle2} tone="success" />
          <Kpi label="Closed (Month)" value={kpis.data.closed_this_month} icon={Archive} tone="success" />
        </div>
      ) : null}

      {/* ---- PRIORITY ATTENTION & MY WORK (spec 21.3) ---- */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Priority attention</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            {attention.isLoading ? <CardSkeleton /> : (
              <>
                <BugMiniList title="Critical" to="/tickets/critical"
                             rows={attention.data?.critical ?? []} />
                <BugMiniList title="Overdue" to="/tickets/overdue"
                             rows={attention.data?.overdue ?? []} showOverdue />
                <BugMiniList title="Update pending" to="/updates/pending"
                             rows={attention.data?.update_pending ?? []} />
                <BugMiniList title="Unassigned" to="/tickets/unassigned"
                             rows={attention.data?.unassigned ?? []} />
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>My work</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            {myWork.isLoading ? <CardSkeleton /> : (
              <>
                <BugMiniList title="Assigned to me" to="/bugs/assigned"
                             rows={myWork.data?.assigned_to_me ?? []} />
                <BugMiniList title="In progress" rows={myWork.data?.in_progress ?? []} />
                <BugMiniList title="In testing" rows={myWork.data?.testing ?? []} />
                <BugMiniList title="Needs today's update" to="/updates/pending"
                             rows={myWork.data?.update_pending ?? []} />
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ---- CHARTS (spec 21.3, 22) ---- */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Bugs by status" loading={charts.isLoading}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={(charts.data?.by_status as ChartDatum[]) ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-25}
                     textAnchor="end" height={60} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} stroke="var(--muted-foreground)" />
              <ChartTooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" name="Bugs" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Open bugs by priority" loading={charts.isLoading}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={(charts.data?.by_priority as ChartDatum[]) ?? []}
                dataKey="count" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2}
              >
                {((charts.data?.by_priority as ChartDatum[]) ?? []).map((entry, index) => (
                  <Cell key={entry.code} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ChartTooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top modules by bug count" loading={charts.isLoading}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={(charts.data?.by_module as ChartDatum[]) ?? []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false}
                     stroke="var(--muted-foreground)" />
              <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11 }}
                     stroke="var(--muted-foreground)" />
              <ChartTooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" name="Bugs" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Opened vs closed (30 days)" loading={charts.isLoading}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={(charts.data?.closure_trend as { date: string }[]) ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)"
                     tickFormatter={(value: string) => value.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} stroke="var(--muted-foreground)" />
              <ChartTooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="opened" name="Opened" stroke="var(--chart-4)"
                    strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="closed" name="Closed" stroke="var(--chart-3)"
                    strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ---- RECENT ACTIVITY (spec 21.3) ---- */}
      <Card>
        <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
        <CardBody>
          {activity.isLoading ? <CardSkeleton rows={5} /> :
           !activity.data || activity.data.length === 0 ? (
            <EmptyState title="No recent activity" />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {activity.data.slice(0, 12).map((row) => (
                <li key={row.id} className="flex items-center gap-3 py-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--muted)]">
                    <Activity className="size-3.5 text-[var(--muted-foreground)]" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px]">
                      {row.bug_id ? (
                        <Link to={`/bugs/detail/${row.bug_id}`}
                              className="font-medium text-[var(--primary)] hover:underline">
                          {row.bug_no}
                        </Link>
                      ) : <span className="font-medium">{row.bug_no}</span>}
                      {" — "}{row.action_label}
                      {row.new_value ? <span className="text-[var(--muted-foreground)]"> · {row.new_value}</span> : null}
                    </p>
                    <p className="text-[11px] text-[var(--muted-foreground)]">
                      {row.actor} · {relativeTime(row.timestamp)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}

const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

const TONE_CLASS = {
  default: "text-[var(--foreground)]",
  danger: "text-[var(--destructive)]",
  warning: "text-[var(--warning)]",
  success: "text-[var(--success)]",
};

function Kpi({
  label, value, icon: Icon, tone = "default", to,
}: {
  label: string; value: number; icon: typeof Activity;
  tone?: keyof typeof TONE_CLASS; to?: string;
}) {
  const display = useCountUp(value);
  const content = (
    <Card className="p-3 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          {label}
        </p>
        <Icon className={`size-3.5 ${TONE_CLASS[tone]}`} aria-hidden />
      </div>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${TONE_CLASS[tone]}`}>{display}</p>
    </Card>
  );
  return to ? <Link to={to} className="block">{content}</Link> : content;
}

function ChartCard({
  title, loading, children,
}: { title: string; loading?: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardBody>
        {loading ? <div className="h-[240px] animate-pulse rounded bg-[var(--muted)]" /> : children}
      </CardBody>
    </Card>
  );
}

function BugMiniList({
  title, rows, to, showOverdue,
}: { title: string; rows: BugListRow[]; to?: string; showOverdue?: boolean }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {title} <span className="ml-1 font-normal">({rows.length})</span>
        </p>
        {to && rows.length > 0 ? (
          <Link to={to} className="text-[11px] text-[var(--primary)] hover:underline">View all</Link>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="text-[12px] text-[var(--muted-foreground)]">Nothing here.</p>
      ) : (
        <ul className="space-y-1">
          {rows.slice(0, 4).map((row) => (
            <li key={row.id}>
              <Link
                to={`/bugs/detail/${row.id}`}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded px-1.5 py-1 hover:bg-[var(--muted)]"
              >
                <span className="shrink-0 text-[11px] font-medium text-[var(--primary)]">
                  {row.bug_no}
                </span>
                <span className="min-w-0 flex-1 basis-full truncate text-[12px] sm:basis-0">
                  {row.title}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {showOverdue && row.is_overdue ? <OverdueBadge days={row.overdue_days} /> : null}
                  <StatusBadge status={row.status} label={row.status_label} showIcon={false} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
