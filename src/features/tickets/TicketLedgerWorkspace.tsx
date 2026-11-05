import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Download, FlaskConical, LayoutList, Maximize2, Minimize2, Play, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { IconButton, Input, Select } from "@/components/ui/primitives";
import type { FilterState } from "@/hooks/useUrlFilters";
import type { MasterRow, UserLite } from "@/types";
import { ledgerScopes, type LedgerScope } from "./ticketLedger";
import "./TicketIntakeFocus.css";
import "./TicketLedgerWorkspace.css";

const metrics = [
  { key: "active", label: "Active work", icon: Play },
  { key: "verify", label: "In verification", icon: FlaskConical },
  { key: "overdue", label: "Past due", icon: CircleAlert },
  { key: "resolved", label: "Resolved", icon: CircleCheck },
] as const;

export function TicketLedgerWorkspace({ children, title, breadcrumb, description, showMetrics = true, scopes, scope, counts, filters, setFilters, resetFilters, companies, developers, canChooseCompany, onExport, exporting, count, page, totalPages }: {
  children: ReactNode;
  title: string;
  /* Breadcrumb trail and the sentence under the heading. Both default to
     the All Tickets wording, so existing callers are unchanged. */
  breadcrumb?: [string, string];
  description?: string;
  /* The four summary tiles above the tabs. All Tickets is the overview
     page and keeps them; the type- and stage-specific lists are already
     one slice each, so the tiles only repeat the row count there. */
  showMetrics?: boolean;
  /* Which stage scopes this preset offers. Closed, for instance, has only
     one meaningful scope, so it passes a single entry. */
  scopes?: readonly { key: LedgerScope; label: string }[];
  scope: LedgerScope;
  counts: Partial<Record<LedgerScope, number>>;
  filters: FilterState;
  setFilters: (updates: Record<string, unknown>) => void;
  resetFilters: () => void;
  companies: MasterRow[];
  developers: UserLite[];
  canChooseCompany: boolean;
  onExport?: () => void;
  exporting?: boolean;
  count: number;
  page: number;
  totalPages: number;
}) {
  /* Compact by default: these lists are read as tables, and the extra row
     height mostly costs rows per screen. The toggle still expands them. */
  const [compact, setCompact] = useState(true);
  const navigate = useNavigate();
  const visibleScopes = (scopes ?? ledgerScopes).filter(({ key }) => key !== "resolved");
  const selectScope = (key: LedgerScope) => {
    if (key === "resolved") navigate("/tickets/closed");
    else setFilters({ scope: key, status: "" });
  };
  return <section className={`ticket-ledger${compact ? " ticket-ledger-compact" : ""}`} aria-label={`${title} workspace`}>
    <header className="ledger-heading">
      <div>
        <nav className="ledger-breadcrumb" aria-label="Breadcrumb">{(breadcrumb ?? ["Ticket management", "All tickets"])[0]} <ChevronRight aria-hidden /> {(breadcrumb ?? ["Ticket management", "All tickets"])[1]}</nav>
        <div className="ledger-title-line"><h1>{title}</h1><span>{counts.all ?? "-"}</span></div>
        <p>{description ?? "Assigned operational tickets across bug, service and access requests."}</p>
      </div>
      {onExport ? <div className="ledger-heading-actions">
        <IconButton label={exporting ? "Exporting tickets" : "Export filtered tickets"} variant="outline" disabled={exporting} onClick={onExport}><Download /></IconButton>
      </div> : null}
    </header>
    {showMetrics && visibleScopes.length > 1 ? <div className="ledger-metrics" aria-label="Ticket summary">{metrics.filter(({ key }) => (scopes ?? ledgerScopes).some((entry) => entry.key === key)).map(({ key, label, icon: Icon }) => <button key={key} type="button" className={`ledger-metric ledger-metric-${key}${scope === key ? " active" : ""}`} aria-pressed={scope === key} onClick={() => selectScope(key)}>
      <span className="ledger-metric-icon"><Icon aria-hidden /></span><span>{label}<strong>{counts[key] == null ? "-" : String(counts[key]).padStart(2, "0")}</strong></span><ArrowUpRight aria-hidden />
    </button>)}</div> : null}
    {visibleScopes.length > 1 ? <div className="ledger-scope-tabs" role="tablist" aria-label="Ticket views">{visibleScopes.map(({ key, label }, index) => <button key={key} id={`ledger-tab-${key}`} type="button" role="tab" aria-selected={scope === key} aria-controls="ledger-results" tabIndex={scope === key ? 0 : -1} className={scope === key ? "active" : ""} onClick={() => selectScope(key)} onKeyDown={(event) => {
      const next = event.key === "ArrowRight" ? (index + 1) % visibleScopes.length : event.key === "ArrowLeft" ? (index + visibleScopes.length - 1) % visibleScopes.length : event.key === "Home" ? 0 : event.key === "End" ? visibleScopes.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault(); selectScope(visibleScopes[next].key); document.getElementById(`ledger-tab-${visibleScopes[next].key}`)?.focus();
    }}>{label}</button>)}</div> : null}
    <div className={`ledger-filters${canChooseCompany ? " ledger-filters-company" : ""}`} role="search" aria-label="Filter tickets">
      <label className="ledger-search"><Search aria-hidden /><Input type="search" placeholder="Search tickets, people, requests..." aria-label="Search tickets" value={String(filters.search ?? "")} onChange={(event) => setFilters({ search: event.target.value })} /></label>
      {canChooseCompany ? <Select aria-label="Company" value={String(filters.company ?? "")} onChange={(event) => setFilters({ company: event.target.value, owner: "" })}><option value="">All companies</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</Select> : null}
      <Select aria-label="Developer" value={String(filters.owner ?? "")} onChange={(event) => setFilters({ owner: event.target.value })}><option value="">All developers</option>{developers.map((developer) => <option key={developer.id} value={developer.id}>{developer.name || developer.username}</option>)}</Select>
      <Select aria-label="Ticket status" value={String(filters.status ?? "")} onChange={(event) => setFilters({ status: event.target.value })}><option value="">All statuses</option>{[
        ["ASSIGNED", "Assigned"], ["IN_PROGRESS", "In progress"], ["PENDING", "Pending"], ["ON_HOLD", "On hold"], ["TESTING", "Testing"], ["REOPENED", "Reopened"], ["PENDING_APPROVAL", "Awaiting approval"], ["APPROVED", "Approved"], ["COMPLETED", "Completed"], ["NEEDS_REVIEW", "Needs review"],
      ].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      <Select aria-label="Ticket type" value={String(filters.ticket_type ?? "")} onChange={(event) => setFilters({ ticket_type: event.target.value })}><option value="">All types</option><option value="BUG">Bug</option><option value="SERVICE_REQUEST">Service</option><option value="ACCESS_REQUEST">Access</option></Select>
      <IconButton label="Reset filters" onClick={resetFilters}><RotateCcw /></IconButton>
    </div>
    <section className="ledger-shell" id="ledger-results" role="tabpanel" aria-labelledby={`ledger-tab-${scope}`}>
      <div className="ledger-table-toolbar"><span><LayoutList aria-hidden /><b>{title}</b><em>{count} tickets</em></span><div>
        <Select aria-label="Sort tickets" value={filters.ordering} onChange={(event) => setFilters({ ordering: event.target.value })}><option value="effective_expected_closure_date">Due date</option><option value="-ledger_priority_rank">Priority</option><option value="title">Request A-Z</option></Select>
        <IconButton label={compact ? "Comfortable rows" : "Compact rows"} onClick={() => setCompact(!compact)}>{compact ? <Maximize2 /> : <Minimize2 />}</IconButton>
      </div></div>
      {children}
      <footer className="ledger-pagination"><span aria-live="polite"><b>{count ? (page - 1) * filters.limit + 1 : 0}-{Math.min(page * filters.limit, count)}</b> of {count} tickets</span><div>
        <label htmlFor="ledger-page-size">Rows</label><Select id="ledger-page-size" aria-label="Rows per page" value={filters.limit} onChange={(event) => setFilters({ limit: Number(event.target.value) })}>{[...new Set([8, 16, 32, filters.limit])].sort((a, b) => a - b).map((size) => <option key={size}>{size}</option>)}</Select>
        <IconButton label="Previous page" variant="outline" disabled={page <= 1} onClick={() => setFilters({ page: page - 1 })}><ChevronLeft /></IconButton><span>{page} / {Math.max(1, totalPages)}</span><IconButton label="Next page" variant="outline" disabled={page >= totalPages} onClick={() => setFilters({ page: page + 1 })}><ChevronRight /></IconButton>
      </div></footer>
    </section>
    <footer className="ledger-page-footer"><span><ShieldCheck aria-hidden />Support workspace</span><span>ZigTrackr</span></footer>
  </section>;
}
