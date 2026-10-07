import { lazy, Suspense, useId, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, Bug, CalendarDays,
  CheckCheck, CheckCircle2, ClipboardList, Clock3, Inbox, KeyRound, Layers,
  Play, RefreshCw, ShieldCheck, Sparkles, UserRound, type LucideIcon,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip as ChartTooltip, XAxis, YAxis,
} from "recharts";
import { format, subDays } from "date-fns";
import { dashboardApi, ticketApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { Button, Skeleton } from "@/components/ui/primitives";
import { ErrorState, PermissionDenied } from "@/components/feedback/states";
import { useAuth } from "@/features/auth/AuthContext";
import { useCountUp } from "@/hooks/useCountUp";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { formatDate, greeting, longDate, relativeTime } from "@/lib/dates";
import { dailyApi } from "@/features/daily-updates/api";
import { attentionParams, chartRows, shortStatus, trendForPeriod, workParams, type AttentionTab, type WorkTab } from "./dashboardModel";
import type { ChartDatum, SupportTicketRow } from "@/types";
import "./DashboardPage.css";

const TicketDetailDialog = lazy(() => import("@/features/tickets/dialogs/TicketDetailDialog").then((m) => ({ default: m.TicketDetailDialog })));
const COLORS = ["var(--dash-violet)", "var(--dash-coral)", "var(--dash-teal)", "var(--dash-blue)", "#c4a2ed", "#b4bfce"];
const WORK_TABS: { key: WorkTab; label: string }[] = [{ key: "all", label: "All active" }, { key: "progress", label: "In progress" }, { key: "verification", label: "Verification" }];
const ATTENTION_TABS: { key: AttentionTab; label: string }[] = [{ key: "overdue", label: "Overdue" }, { key: "critical", label: "Critical" }, { key: "unassigned", label: "Unassigned" }];
const ATTENTION_ROUTES = { overdue: "/tickets/overdue", critical: "/tickets/critical", unassigned: "/tickets/unassigned" };
const delay = (ms: number) => ({ "--enter-delay": `${ms}ms` } as CSSProperties);

export function DashboardPage() {
  const { user, can } = useAuth();
  const reduced = usePrefersReducedMotion();
  const gradientId = useId().replaceAll(":", "");
  const [period, setPeriod] = useState(30);
  const [workTab, setWorkTab] = useState<WorkTab>("all");
  const [attentionTab, setAttentionTab] = useState<AttentionTab>("overdue");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const canDashboard = can("dashboard.dashboard.view");
  const canReadTickets = can("tickets.ticket.view");
  const canReadActivity = canReadTickets && can("bugs.update.view");
  const kpis = useQuery({ queryKey: queryKeys.dashboard.kpis, queryFn: dashboardApi.kpis, enabled: canDashboard, staleTime: 60_000 });
  const charts = useQuery({ queryKey: queryKeys.dashboard.charts, queryFn: dashboardApi.charts, enabled: canDashboard, staleTime: 60_000 });
  const myParams = workParams(workTab);
  const work = useQuery({ queryKey: queryKeys.tickets.list(myParams), queryFn: () => ticketApi.list(myParams), enabled: canDashboard && canReadTickets, staleTime: 60_000 });
  const urgentParams = attentionParams(attentionTab);
  const attention = useQuery({ queryKey: queryKeys.tickets.list(urgentParams), queryFn: () => ticketApi.list(urgentParams), enabled: canDashboard && canReadTickets, staleTime: 60_000 });
  const activityParams = { from_date: format(subDays(new Date(), 6), "yyyy-MM-dd"), to_date: format(new Date(), "yyyy-MM-dd"), category: "all", limit: 4, page: 1 };
  const activity = useQuery({ queryKey: queryKeys.tickets.dailyUpdates(activityParams), queryFn: () => dailyApi.list(activityParams), enabled: canDashboard && canReadActivity, staleTime: 60_000 });

  const trend = trendForPeriod(charts.data?.closure_trend ?? [], period);
  const opened = trend.reduce((sum, day) => sum + day.opened, 0);
  const closed = trend.reduce((sum, day) => sum + day.closed, 0);
  const priorities = chartRows(charts.data?.by_priority ?? []);
  const priorityTotal = priorities.reduce((sum, row) => sum + row.count, 0);
  const statuses = chartRows(charts.data?.by_status ?? []).sort((a, b) => b.count - a.count).slice(0, 5);
  const modules = chartRows(charts.data?.by_module ?? []).sort((a, b) => b.count - a.count).slice(0, 5);

  async function refresh() {
    setRefreshing(true);
    try {
      await Promise.allSettled([kpis.refetch(), charts.refetch(),
        ...(canReadTickets ? [work.refetch(), attention.refetch()] : []),
        ...(canReadActivity ? [activity.refetch()] : [])]);
    } finally { setRefreshing(false); }
  }

  if (!canDashboard) return <PermissionDenied />;

  return <div className="dashboard-page">
    <header className="dash-header dash-enter">
      <div>
        <div className="dash-eyebrow"><span /> Workspace overview</div>
        <h1>{greeting()}, {user?.name?.split(" ")[0] || "there"}<span className="ml-2 text-[var(--dash-violet)]">✦</span></h1>
        <p>Here's what's happening with your tickets today.</p>
      </div>
      <div className="dash-header-actions">
        <div className="dash-updated"><span>●</span>{kpis.dataUpdatedAt ? `Updated ${format(kpis.dataUpdatedAt, "hh:mm a")}` : "Current snapshot"}</div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing} aria-label="Refresh dashboard"><RefreshCw className={refreshing && !reduced ? "animate-spin" : ""} /><span>Refresh</span></Button>
      </div>
    </header>

    {kpis.isLoading ? <div className="dash-kpis">{Array.from({ length: 4 }, (_, i) => <div key={i} className="dash-surface p-4"><Skeleton className="h-7 w-28" /><Skeleton className="mt-3 h-9 w-16" /><Skeleton className="mt-2 h-3 w-32" /></div>)}</div>
      : kpis.isError ? <div className="dash-surface"><ErrorState title="Summary couldn't be loaded" onRetry={() => void kpis.refetch()} className="py-8" /></div>
      : kpis.data ? <>
        <div className="dash-kpis">
          <Metric label="Open tickets" value={kpis.data.total_open} icon={Layers} color="var(--dash-violet)" note={`${kpis.data.new_today} received today`} to={can("tickets.all.access") ? "/tickets" : undefined} delayMs={30} />
          <Metric label="In progress" value={kpis.data.in_progress} icon={Play} color="var(--dash-blue)" note="Active development & service work" to={can("tickets.all.access") ? "/tickets?status=IN_PROGRESS" : undefined} delayMs={70} />
          <Metric label="Awaiting verification" value={kpis.data.testing} icon={ShieldCheck} color="var(--dash-coral)" note="Rectified and ready to review" to={can("tickets.testing.access") ? "/tickets/testing" : undefined} delayMs={110} />
          <Metric label="Closed this month" value={kpis.data.closed_this_month} icon={CheckCheck} color="var(--dash-teal)" note={`${kpis.data.closed_today} closed today`} to={can("tickets.closed.access") ? "/tickets/closed" : undefined} delayMs={150} />
        </div>
        <div className="dash-context dash-surface dash-enter" style={delay(180)}>
          <span className="dash-context-label"><Sparkles className="size-3.5" /> At a glance</span>
          <div className="dash-signals">
            <Signal label="Unassigned" value={kpis.data.unassigned} color="var(--dash-violet)" />
            <Signal label="Critical" value={kpis.data.critical} color="var(--destructive)" />
            <Signal label="High priority" value={kpis.data.high} color="var(--dash-coral)" />
            <Signal label="Overdue" value={kpis.data.overdue} color="var(--warning)" />
            <Signal label="Reopened" value={kpis.data.reopened} color="var(--dash-blue)" />
          </div>
        </div>
      </> : null}

    <div className="dash-charts">
      <section className="dash-surface dash-enter" style={delay(220)} aria-label="Bug activity trend">
        <PanelHeader title="Bug activity" subtitle="Intake and closures over time">
          <div className="dash-period" role="group" aria-label="Bug trend period">{[7, 14, 30].map(days => <button type="button" key={days} aria-pressed={period === days} onClick={() => setPeriod(days)}>{days} days</button>)}</div>
        </PanelHeader>
        {charts.isError ? <PanelError onRetry={() => void charts.refetch()} /> : charts.isLoading ? <ChartLoading /> : trend.length === 0 || opened + closed === 0 ? <QuietState title="No bug activity in this period" description="New and closed bugs will appear here as work moves forward." /> : <>
          <div className="dash-trend-totals">
            <span className="dash-trend-total"><i className="dash-legend-dot bg-[var(--dash-violet)]" />Opened <strong>{opened.toLocaleString()}</strong><ArrowUpRight className="size-3 text-[var(--dash-violet)]" /></span>
            <span className="dash-trend-total"><i className="dash-legend-dot bg-[var(--dash-teal)]" />Closed <strong>{closed.toLocaleString()}</strong><ArrowDownLeft className="size-3 text-[var(--dash-teal)]" /></span>
          </div>
          <div className="dash-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} accessibilityLayer>
                <defs>
                  <linearGradient id={`${gradientId}-opened`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--dash-violet)" stopOpacity={.2} /><stop offset="100%" stopColor="var(--dash-violet)" stopOpacity={0} /></linearGradient>
                  <linearGradient id={`${gradientId}-closed`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--dash-teal)" stopOpacity={.08} /><stop offset="100%" stopColor="var(--dash-teal)" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" strokeOpacity={.6} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} minTickGap={24} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} tickFormatter={(value: string) => formatDate(value).slice(0, 6)} dy={6} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
                <ChartTooltip cursor={{ stroke: "var(--dash-violet)", strokeDasharray: "3 3" }} content={({ active, payload, label }) => active && payload?.length ? <div className="dash-tooltip"><p>{formatDate(String(label))}</p>{payload.map(row => <div key={String(row.dataKey)} className="dash-tooltip-row"><span style={{ color: row.color }}>{row.name}</span><strong>{String(row.value)}</strong></div>)}</div> : null} />
                <Area type="monotone" dataKey="opened" name="Opened" stroke="var(--dash-violet)" strokeWidth={2.5} fill={`url(#${gradientId}-opened)`} isAnimationActive={!reduced} animationDuration={800} activeDot={{ r: 4, strokeWidth: 3, stroke: "var(--card)" }} />
                <Area type="monotone" dataKey="closed" name="Closed" stroke="var(--dash-teal)" strokeWidth={2} fill={`url(#${gradientId}-closed)`} isAnimationActive={!reduced} animationDuration={800} activeDot={{ r: 4, strokeWidth: 3, stroke: "var(--card)" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>}
        <div className="dash-chart-foot">Bug analytics · Last {period} days · Summary cards above cover all ticket types.</div>
      </section>

      <section className="dash-surface dash-enter" style={delay(260)} aria-label="Open bug priorities">
        <PanelHeader title="Open bug priorities" subtitle="A clear view of what needs focus"><span className="dash-panel-counter">Current</span></PanelHeader>
        {charts.isError ? <PanelError onRetry={() => void charts.refetch()} /> : charts.isLoading ? <ChartLoading /> : !priorityTotal ? <QuietState icon={CheckCircle2} title="No open bugs" description="Your visible bug queue is clear." /> : <div className="dash-donut-layout">
          <div className="dash-donut">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart><Pie data={priorities} dataKey="count" nameKey="label" innerRadius="70%" outerRadius="92%" paddingAngle={priorityTotal > 1 ? 3 : 0} cornerRadius={4} stroke="none" startAngle={90} endAngle={-270} isAnimationActive={!reduced} animationDuration={800}>
              {priorities.map((row, i) => <Cell key={row.code || row.label} fill={row.color || COLORS[i % COLORS.length]} />)}
            </Pie><ChartTooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 11 }} /></PieChart></ResponsiveContainer>
            <div className="dash-donut-center"><strong>{priorityTotal.toLocaleString()}</strong><span>open bugs</span></div>
          </div>
          <ul className="dash-priorities">{priorities.map((row, i) => <li key={row.code || row.label} className="dash-priority"><i className="dash-legend-dot" style={{ background: row.color || COLORS[i % COLORS.length] }} /><span title={row.label}>{row.label}</span><div><strong>{row.count.toLocaleString()}</strong><small>{Math.round(row.count / priorityTotal * 100)}%</small></div></li>)}</ul>
        </div>}
        <div className="dash-chart-foot">Priorities reflect the bugs you have permission to view.</div>
      </section>
    </div>

    <div className="dash-work-grid">
      <section className="dash-surface dash-enter" style={delay(300)}>
        <PanelHeader title="My work" subtitle="Your bug, service and access tickets"><span className="dash-panel-counter"><UserRound className="mr-1 inline size-3" />Assigned to you</span></PanelHeader>
        <QueueTabs tabs={WORK_TABS} selected={workTab} onSelect={setWorkTab} label="My work filter" />
        <div className="dash-queue">{!canReadTickets ? <QuietState icon={ShieldCheck} title="Ticket access required" description="Ask your administrator for access to your ticket queue." /> : work.isLoading ? <QueueLoading /> : work.isError ? <PanelError onRetry={() => void work.refetch()} /> : work.data?.results.length ? work.data.results.map(row => <TicketRow key={row.id} row={row} onOpen={setTicketId} />) : <QuietState icon={CheckCircle2} title={workTab === "all" ? "You're all caught up" : "No tickets in this queue"} description="Assigned work will appear here. Enjoy the clear view." />}</div>
        <div className="dash-panel-footer"><span>{work.data ? `Showing ${work.data.results.length} of ${work.data.count} tickets` : "Only your assigned tickets"}</span>{can("tickets.all.access") ? <Link to="/tickets?owner=me" className="dash-text-link">View my tickets <ArrowRight className="size-3" /></Link> : null}</div>
      </section>
      <section className="dash-surface dash-enter" style={delay(340)}>
        <PanelHeader title="Needs attention" subtitle="Keep the next important action in sight"><span className="dash-panel-counter">Priority queue</span></PanelHeader>
        <QueueTabs tabs={ATTENTION_TABS} selected={attentionTab} onSelect={setAttentionTab} label="Attention queue filter" />
        <div className="dash-queue">{!canReadTickets ? <QuietState icon={ShieldCheck} title="Ticket access required" description="This panel is visible when your role can read tickets." /> : attention.isLoading ? <QueueLoading /> : attention.isError ? <PanelError onRetry={() => void attention.refetch()} /> : attention.data?.results.length ? attention.data.results.map(row => <TicketRow key={row.id} row={row} onOpen={setTicketId} overdue={attentionTab === "overdue"} />) : <QuietState icon={CheckCircle2} title={`No ${attentionTab} tickets`} description="Nothing needs your attention in this queue right now." />}</div>
        <div className="dash-panel-footer"><span>{attention.data ? `${attention.data.count} tickets in this queue` : "Permission-scoped tickets"}</span>{can(`tickets.${attentionTab}.access`) ? <Link to={ATTENTION_ROUTES[attentionTab]} className="dash-text-link">View queue <ArrowRight className="size-3" /></Link> : null}</div>
      </section>
    </div>

    <div className="dash-insights">
      <section className="dash-surface dash-enter" style={delay(380)}><PanelHeader title="Bug workflow" subtitle="State distribution · visible bugs" />{charts.isLoading ? <QueueLoading /> : charts.isError ? <PanelError onRetry={() => void charts.refetch()} /> : <Distribution rows={statuses.map(row => ({ ...row, label: shortStatus(row.code, row.label) }))} empty="No bug workflow data" />}</section>
      <section className="dash-surface dash-enter" style={delay(420)}><PanelHeader title="Top modules" subtitle="Where visible bugs are concentrated" />{charts.isLoading ? <QueueLoading /> : charts.isError ? <PanelError onRetry={() => void charts.refetch()} /> : <Distribution rows={modules} empty="No module data yet" />}</section>
      <section className="dash-surface dash-enter" style={delay(460)}>
        <PanelHeader title="Recent activity" subtitle="Ticket updates from the last 7 days">{canReadActivity ? <Link to="/updates/today" className="dash-text-link">Daily updates <ArrowUpRight className="size-3" /></Link> : null}</PanelHeader>
        {!canReadActivity ? <QuietState icon={ShieldCheck} title="Activity access required" description="Your role needs Daily Updates and ticket viewing access." /> : activity.isLoading ? <QueueLoading /> : activity.isError ? <PanelError onRetry={() => void activity.refetch()} /> : !activity.data?.results.length ? <QuietState icon={Activity} title="No recent ticket activity" description="Assignments, fixes, closures and updates will appear here." /> : <ol className="dash-activity">{activity.data.results.map(row => <li key={`${row.kind}-${row.row_id}`} className="dash-event">
          <span className="dash-event-icon">{row.category === "closed" ? <CheckCheck className="size-3" /> : row.category === "rectified" ? <ShieldCheck className="size-3" /> : <Activity className="size-3" />}</span>
          <div className="dash-event-copy"><p><button type="button" className="dash-text-link" onClick={() => setTicketId(row.ticket_uuid)}>{row.reference}</button></p><p title={row.text}>{row.text}</p><span>{row.actor_name || "System"}</span></div><time className="dash-event-time" dateTime={row.at} title={formatDate(row.at)}>{relativeTime(row.at)}</time>
        </li>)}</ol>}
      </section>
    </div>
    <p className="dash-page-note"><CalendarDays className="mr-1 inline size-3" />{longDate()} · Data is scoped to your permissions. No sample figures.</p>
    {ticketId ? <Suspense fallback={null}><TicketDetailDialog open ticketId={ticketId} onOpenChange={(open) => { if (!open) setTicketId(null); }} showVerifyClose={can("tickets.ticket.verify_close")} /></Suspense> : null}
  </div>;
}

function Metric({ label, value, icon: Icon, color, note, to, delayMs }: { label: string; value: number; icon: LucideIcon; color: string; note: string; to?: string; delayMs: number }) {
  const display = useCountUp(value, 750);
  const content = <><div className="dash-stat-top"><span className="dash-stat-icon"><Icon className="size-3.5" aria-hidden /></span><h2>{label}</h2></div><p className="dash-stat-value" aria-label={`${value} ${label}`}>{display.toLocaleString()}</p><div className="dash-stat-bottom"><span>{note}</span>{to ? <ArrowUpRight className="size-3" aria-hidden /> : null}</div></>;
  const style = { ...delay(delayMs), "--stat-color": color } as CSSProperties;
  return to ? <Link to={to} className="dash-stat dash-surface dash-enter dash-stat-link" style={style}>{content}</Link> : <section className="dash-stat dash-surface dash-enter" style={style}>{content}</section>;
}

function Signal({ label, value, color }: { label: string; value: number; color: string }) {
  return <span className="dash-signal"><i className="dash-signal-dot" style={{ background: color }} /><span>{label}</span><strong>{value.toLocaleString()}</strong></span>;
}

function PanelHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return <header className="dash-panel-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{children}</header>;
}

function QueueTabs<T extends string>({ tabs, selected, onSelect, label }: { tabs: { key: T; label: string }[]; selected: T; onSelect: (key: T) => void; label: string }) {
  return <div className="dash-tabs" role="group" aria-label={label}>{tabs.map(tab => <button type="button" key={tab.key} aria-pressed={selected === tab.key} onClick={() => onSelect(tab.key)}>{tab.label}</button>)}</div>;
}

function TicketRow({ row, onOpen, overdue }: { row: SupportTicketRow; onOpen: (id: string) => void; overdue?: boolean }) {
  const Icon = row.ticket_type === "BUG" ? Bug : row.ticket_type === "ACCESS_REQUEST" ? KeyRound : ClipboardList;
  const status = row.effective_status || row.status;
  return <button type="button" className="dash-ticket-row" onClick={() => onOpen(row.id)} aria-label={`Open ${row.reference}: ${row.title}`}>
    <span className="dash-ticket-icon"><Icon className="size-3.5" aria-hidden /></span>
    <span className="dash-ticket-copy"><strong title={row.title}>{row.title}</strong><span className="dash-ticket-meta"><span className="dash-ticket-ref">{row.reference}</span><span>·</span><span>{row.ticket_type === "BUG" ? "Bug" : row.ticket_type === "SERVICE_REQUEST" ? "Service" : row.ticket_type === "ACCESS_REQUEST" ? "Access" : "Unclassified"}</span></span></span>
    {overdue && row.overdue_days ? <span className="dash-ticket-badge text-[var(--destructive)]"><Clock3 className="mr-1 inline size-2.5" />{row.overdue_days}d late</span> : <span className="dash-ticket-badge" data-status={status}>{status === "TESTING" ? "Rectified" : status.replaceAll("_", " ").toLowerCase().replace(/^./, letter => letter.toUpperCase())}</span>}
  </button>;
}

function Distribution({ rows, empty }: { rows: ChartDatum[]; empty: string }) {
  const max = Math.max(...rows.map(row => row.count), 1);
  return rows.length ? <ul className="dash-bars">{rows.map((row, i) => <li key={`${row.code || row.label}-${i}`}><div className="dash-bar-label"><span title={row.label}>{row.label}</span><strong>{row.count.toLocaleString()}</strong></div><div className="dash-bar-track"><div className="dash-bar-fill" style={{ width: `${row.count / max * 100}%`, background: COLORS[i % COLORS.length] }} /></div></li>)}</ul> : <QuietState icon={Layers} title={empty} description="Your chart will fill in when there is data to show." />;
}

function QuietState({ icon: Icon = Inbox, title, description }: { icon?: LucideIcon; title: string; description: string }) {
  return <div className="dash-empty"><Icon aria-hidden /><strong>{title}</strong><p>{description}</p></div>;
}
function PanelError({ onRetry }: { onRetry: () => void }) { return <ErrorState onRetry={onRetry} className="py-8" />; }
function ChartLoading() { return <div className="p-5"><Skeleton className="h-[235px] w-full rounded-xl" /></div>; }
function QueueLoading() { return <div className="space-y-4 p-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="flex items-center gap-3"><Skeleton className="size-7 rounded-lg" /><div className="flex-1"><Skeleton className="h-3 w-4/5" /><Skeleton className="mt-2 h-2 w-2/5" /></div></div>)}</div>; }
