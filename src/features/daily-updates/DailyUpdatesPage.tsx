import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Search, X } from "lucide-react";
import { queryKeys } from "@/api/queryKeys";
import { apiErrorMessage } from "@/api/client";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { Button, IconButton, Spinner } from "@/components/ui/primitives";
import { useAuth } from "@/features/auth/AuthContext";
import { TicketDetailDialog } from "@/features/tickets/dialogs/TicketDetailDialog";
import { initials } from "@/lib/utils";
import { categories, dailyApi, emptyCounts, type Tab } from "./api";
import { asDate, calendarDays, formatDay, inSelection, monthKey, selectDate, shiftDate, shiftMonth, todayKey, type DateSelection } from "./calendar";
import "./DailyUpdatesPage.css";

const labels = { all: "All", unassigned: "Unassigned", assigned: "Assigned", rectified: "Rectified", closed: "Closed", other: "Update" };
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const months = Array.from({ length: 12 }, (_, index) => new Date(Date.UTC(2026, index, 1)).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" }));

export function DailyUpdatesPage() {
  const { can } = useAuth();
  const [selection, setSelection] = useState<DateSelection>(() => ({ range: false, from: todayKey(), to: todayKey() }));
  const [month, setMonth] = useState(() => monthKey(todayKey()));
  const [focusDate, setFocusDate] = useState(todayKey);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const dates = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const calendar = useQuery({
    queryKey: queryKeys.tickets.dailyCalendar(month), queryFn: () => dailyApi.calendar(month),
    staleTime: 30_000, refetchInterval: 60_000,
  });
  const params = { from_date: selection.from, to_date: selection.to ?? selection.from, category: tab, search: debouncedSearch, page, limit: 25 };
  const updates = useQuery({
    queryKey: queryKeys.tickets.dailyUpdates(params), queryFn: () => dailyApi.list(params),
    enabled: Boolean(selection.from), staleTime: 30_000, refetchInterval: 60_000,
  });
  const today = calendar.data?.today ?? todayKey();
  const counts = selection.from && !updates.isError ? updates.data?.counts : undefined;
  const shownCounts = counts ?? emptyCounts;
  const grid = calendarDays(month);
  const year = asDate(month).getUTCFullYear();
  const monthIndex = asDate(month).getUTCMonth();
  const years = Array.from({ length: Math.max(year, asDate(today).getUTCFullYear() + 5) - Math.min(2000, year) + 1 }, (_, i) => Math.min(2000, year) + i);
  const rangePending = selection.range && selection.from && !selection.to;
  const heading = !selection.from ? "Select a date" : rangePending ? `From ${formatDay(selection.from)}`
    : selection.to !== selection.from ? `${formatDay(selection.from)} – ${formatDay(selection.to!)}` : formatDay(selection.from, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const hint = !selection.from ? (selection.range ? "Choose a From date, then a To date." : "Choose a date to view its ticket activity.")
    : rangePending ? "Now select the To date. You can move to another month." : selection.range ? `From ${formatDay(selection.from)} to ${formatDay(selection.to!)}, both days included.` : "Ticket activity recorded on this date.";
  const countLabel = (value: number) => counts ? value.toLocaleString() : selection.from ? "—" : "0";

  function choose(key: string) {
    setSelection((previous) => selectDate(previous, key)); setFocusDate(key); setMonth(monthKey(key)); setPage(1);
    window.requestAnimationFrame(() => dates.current.get(key)?.focus({ preventScroll: true }));
  }
  function toggleRange(enabled: boolean) {
    const key = selection.to ?? selection.from ?? today;
    setSelection(enabled ? { range: true, from: null, to: null } : { range: false, from: key, to: key });
    if (!enabled) { setFocusDate(key); setMonth(monthKey(key)); }
    setTab("all"); setSearch(""); setDebouncedSearch(""); setPage(1);
  }
  function clearDates() {
    setSelection({ range: selection.range, from: null, to: null });
    setTab("all"); setSearch(""); setDebouncedSearch(""); setPage(1);
  }
  function changeMonth(next: string) { setMonth(next); setFocusDate(next); }
  function changeTab(next: Tab) { setTab(next); setPage(1); }
  function goToday() {
    setSelection({ range: false, from: today, to: today }); setMonth(monthKey(today)); setFocusDate(today);
    setTab("all"); setSearch(""); setDebouncedSearch(""); setPage(1);
  }
  function moveFocus(key: string, event: React.KeyboardEvent<HTMLButtonElement>) {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const next = shiftDate(key, offsets[event.key]);
    setFocusDate(next);
    setMonth(monthKey(next));
    window.requestAnimationFrame(() => dates.current.get(next)?.focus());
  }

  return <div className="daily-updates">
    <PageHeader title="Daily Updates" description="A clear view of your team's ticket activity, one day at a time."
      breadcrumbs={[{ label: "Daily Work" }, { label: "Daily Updates" }]} actions={<span className="du-heading-icon"><CalendarDays aria-hidden /></span>} />
    <section className="du-calendar-card" aria-label="Monthly ticket activity calendar">
      <div className="du-month-pane">
        <div className="du-calendar-title"><span className="du-calendar-icon"><CalendarDays aria-hidden /></span><div><h2>{months[monthIndex]} {year}</h2><p>{calendar.isFetching ? "Refreshing activity…" : "Your visible ticket activity"}</p></div></div>
        <div className="du-controls">
          <select aria-label="Calendar month" value={monthIndex} onChange={(e) => changeMonth(`${year}-${String(Number(e.target.value) + 1).padStart(2, "0")}-01`)}>{months.map((name, index) => <option key={name} value={index}>{name}</option>)}</select>
          <select aria-label="Calendar year" value={year} onChange={(e) => changeMonth(`${e.target.value}-${String(monthIndex + 1).padStart(2, "0")}-01`)}>{years.map((value) => <option key={value}>{value}</option>)}</select>
          <label className="du-range-toggle" title="Select a date range"><input type="checkbox" aria-label="Select a date range" aria-describedby="du-date-help" checked={selection.range}
            onChange={(e) => toggleRange(e.target.checked)} /></label>
          <Button size="sm" variant="ghost" onClick={goToday}>Today</Button>
          <IconButton label="Previous month" onClick={() => changeMonth(shiftMonth(month, -1))} disabled={year === 1900 && monthIndex === 0}><ChevronLeft /></IconButton>
          <IconButton label="Next month" onClick={() => changeMonth(shiftMonth(month, 1))} disabled={year === 2200 && monthIndex === 11}><ChevronRight /></IconButton>
        </div>
        <p className="sr-only" id="du-date-help">Select a date, or check the box between year and Today to choose From then To. Use arrow keys to move and Enter or Space to select. Today restores single-date mode.</p>
        <div className="du-weekdays" aria-hidden>{weekdays.map((name) => <span key={name}>{name}</span>)}</div>
        <div className="du-calendar-grid" role="group" aria-label="Choose a date or date range" aria-describedby="du-date-help">
          {grid.map((key) => {
            const selected = inSelection(selection, key);
            const endpoint = selected && (key === selection.from || key === selection.to);
            const activity = calendar.data?.days[key];
            return <button type="button" key={key} ref={(element) => { if (element) dates.current.set(key, element); else dates.current.delete(key); }}
              className={`du-day${key.slice(0, 7) !== month.slice(0, 7) ? " du-outside" : ""}${key === today ? " du-today" : ""}${selected ? endpoint ? " du-selected" : " du-in-range" : ""}`}
              aria-label={`${formatDay(key)}, ${calendar.isError ? "activity unavailable" : calendar.isPending ? "loading activity" : `${activity?.all ?? 0} updates`}${key === today ? ", today" : ""}`}
              aria-pressed={selected} aria-current={key === today ? "date" : undefined} tabIndex={key === focusDate ? 0 : -1}
              onKeyDown={(event) => moveFocus(key, event)} onFocus={() => setFocusDate(key)} onClick={() => choose(key)}>
              <span>{asDate(key).getUTCDate()}</span><span className="du-dots" aria-hidden>{categories.filter((category) => activity?.[category]).map((category) => <i key={category} className={`du-dot du-${category}`} />)}{activity?.other && !categories.some((category) => activity[category]) ? <i className="du-dot du-other" /> : null}</span>
            </button>;
          })}
        </div>
        <div className="du-legend">{categories.map((category) => <span key={category}><i className={`du-dot du-${category}`} />{labels[category]}</span>)}</div>
        {calendar.isError ? <div className="du-calendar-error">Calendar activity unavailable. <button onClick={() => void calendar.refetch()}>Retry</button></div> : null}
      </div>
      <div className="du-overview"><span className="du-eyebrow">{selection.range ? "SELECTED DATE RANGE" : "SELECTED DAY OVERVIEW"}</span><h2>{heading}</h2><p>{hint}</p>
        <div className="du-summary">{categories.map((category) => <button type="button" key={category} className={`du-stat du-${category}`} onClick={() => changeTab(category)} aria-pressed={tab === category}><span><i className={`du-dot du-${category}`} />{labels[category]}</span><strong>{countLabel(shownCounts[category])}</strong></button>)}</div>
        <p className="du-overview-note"><Clock3 aria-hidden /> Counts show recorded activity, not current ticket totals.</p>
      </div>
    </section>
    <section className="du-details" aria-label="Selected date activity">
      <div className="du-detail-heading"><div><h2>{heading}</h2><p aria-live="polite">{hint}</p></div><button type="button" className="du-clear" disabled={!selection.from} onClick={clearDates}>Clear</button></div>
      <div className="du-list-card">
        <div className="du-toolbar"><div className="du-tabs" role="tablist" aria-label="Activity category">{(["all", ...categories] as Tab[]).map((category, index, tabs) => <button key={category} type="button" role="tab" aria-selected={tab === category} aria-controls="du-results" id={`du-tab-${category}`} tabIndex={tab === category ? 0 : -1}
          onClick={() => changeTab(category)} onKeyDown={(event) => { let next: Tab | undefined; if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length]; if (event.key === "ArrowLeft") next = tabs[(index + tabs.length - 1) % tabs.length]; if (event.key === "Home") next = tabs[0]; if (event.key === "End") next = tabs[tabs.length - 1]; if (next) { event.preventDefault(); changeTab(next); document.getElementById(`du-tab-${next}`)?.focus(); } }}>
          {labels[category]}<span>{countLabel(shownCounts[category])}</span></button>)}</div>
          <div className="du-search"><Search aria-hidden /><input aria-label="Search daily ticket activity" placeholder="Search ticket or request…" value={search} maxLength={200} onChange={(e) => setSearch(e.target.value)} />{search ? <IconButton label="Clear search" onClick={() => setSearch("")}><X /></IconButton> : null}</div>
        </div>
        <div className="du-results" id="du-results" role="tabpanel" aria-labelledby={`du-tab-${tab}`} tabIndex={0} aria-busy={Boolean(selection.from && updates.isFetching)}>
          {!selection.from ? <EmptyState title="Select a date to see updates" description={hint} icon={<CalendarDays className="size-8" />} />
            : updates.isPending ? <div className="du-loading"><Spinner /><span>Loading ticket activity…</span></div>
            : updates.isError ? <ErrorState description={apiErrorMessage(updates.error)} onRetry={() => void updates.refetch()} />
            : !updates.data?.results.length ? <EmptyState title="No updates found" description={search ? "Try another search or clear the search field." : `No ${tab === "all" ? "ticket" : labels[tab].toLowerCase()} activity was recorded for this selection.`} />
            : <table><colgroup><col style={{ width: "14%" }} /><col style={{ width: "32%" }} /><col style={{ width: "15%" }} /><col style={{ width: "18%" }} /><col style={{ width: "12%" }} /><col style={{ width: "9%" }} /></colgroup><thead><tr><th>Ticket</th><th>Request / Details</th><th>Update</th><th>Assigned to</th><th>Time</th><th>Priority</th></tr></thead><tbody>{updates.data.results.map((row) => <tr key={`${row.kind}-${row.row_id}`}>
              <td><button type="button" className="du-reference" title="Open ticket details" onClick={() => setTicketId(row.ticket_uuid)}>{row.reference}</button></td>
              <td><p className="du-request" title={row.request_title}>{row.request_title}</p><p className="du-meta">{row.ticket_type.replaceAll("_", " ").toLowerCase()}{row.project_name ? ` · ${row.project_name}` : ""}</p><p className="du-update-text" title={row.text}>{row.text || "Ticket activity recorded."}</p>{row.actor_name ? <p className="du-meta">By {row.actor_name}</p> : null}</td>
              <td><span className={`du-status du-${row.category}`}><i className={`du-dot du-${row.category}`} />{labels[row.category]}</span></td>
              <td>{row.owner_name ? <div className="du-person"><span className="du-avatar" aria-hidden>{initials(row.owner_name)}</span><div><p title={row.owner_name}>{row.owner_name}</p><span title={row.owner_role}>{row.owner_role || "Team member"}</span></div></div> : <span className="du-meta">Unassigned</span>}</td>
              <td className="du-time">{new Intl.DateTimeFormat("en-GB", { timeZone: updates.data.timezone, hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(row.at))}{selection.range ? <span>{new Intl.DateTimeFormat("en-GB", { timeZone: updates.data.timezone, day: "2-digit", month: "short", year: "numeric" }).format(new Date(row.at))}</span> : null}</td>
              <td><span className="du-priority" title={row.priority_name}>{row.priority_name || "—"}</span></td>
            </tr>)}</tbody></table>}
        </div>
        <footer className="du-footer"><span>{selection.from && updates.data && !updates.isError ? `${updates.data.count ? (page - 1) * 25 + 1 : 0}–${Math.min(page * 25, updates.data.count)} of ${updates.data.count} updates` : "Select a date to explore updates"}</span><span className="du-scope-note">Only tickets you can access · {updates.data?.timezone ?? calendar.data?.timezone ?? "Asia/Kolkata"}</span>{updates.data && updates.data.total_pages > 1 && selection.from ? <div><IconButton label="Previous page" disabled={page === 1 || updates.isFetching} onClick={() => setPage(page - 1)}><ChevronLeft /></IconButton><span>{page} / {updates.data.total_pages}</span><IconButton label="Next page" disabled={page >= updates.data.total_pages || updates.isFetching} onClick={() => setPage(page + 1)}><ChevronRight /></IconButton></div> : null}</footer>
      </div>
    </section>
    <TicketDetailDialog open={Boolean(ticketId)} ticketId={ticketId} onOpenChange={(open) => { if (!open) setTicketId(null); }} showVerifyClose={can("tickets.ticket.verify_close")} />
  </div>;
}
