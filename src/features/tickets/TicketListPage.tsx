import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  AlertOctagon, AlertTriangle, Archive, CheckCircle2, ChevronDown, FlaskConical, Inbox, Pause,
  Play, PlayCircle, KeyRound, LifeBuoy, ListFilter, ClipboardList, RotateCcw,
  Paperclip, Pencil, ArrowUpRight, LayoutList, Rows3, Columns3, Search,
} from "lucide-react";
import { toast } from "sonner";
import { ticketApi } from "@/api/services";
import { apiErrorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { useCompanies } from "@/hooks/useMasters";
import { PageHeader } from "@/components/common/PageHeader";
import { Button, IconButton, Input, Select, Spinner } from "@/components/ui/primitives";
import { DataTable, TruncatedCell, type Column } from "@/components/tables/DataTable";
import { Pagination } from "@/components/tables/Pagination";
import { ErrorState } from "@/components/feedback/states";
import { ConfirmDialog, Modal } from "@/components/feedback/Modal";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/AuthContext";
import type { SupportTicketRow, TicketRemovalPayload } from "@/types";
import { EmailAttachmentList } from "./EmailAttachmentList";
import { DeleteUnassignedTicketDialog } from "./dialogs/DeleteUnassignedTicketDialog";
import { PriorityBadge } from "@/components/common/badges";
import { ReviewAssignDialog } from "@/features/tickets/dialogs/ReviewAssignDialog";
import { WorkDetailsDialog } from "@/features/tickets/dialogs/WorkDetailsDialog";
import { TicketStatusBadge } from "@/features/tickets/TicketTableCells";
import { TicketEmailDescription } from "./TicketEmailDescription";
import { IntakeReceived, IntakeSender, IntakeSource, IntakeType, IntakeWaiting } from "./TicketIntakeCells";
import { intakeParams, intakeView, intakeViews } from "./ticketIntake";
import type { TicketWorkAction as WorkAction } from "@/features/tickets/dialogs/TicketDetailDialog";
import "./TicketWorkControl.css";
import "./TicketIntakeFocus.css";

const TicketDetailDialog = lazy(() => import("@/features/tickets/dialogs/TicketDetailDialog")
  .then((module) => ({ default: module.TicketDetailDialog })));

export type TicketPreset =
  | "all" | "unassigned" | "bugs" | "services" | "access"
  | "critical" | "overdue" | "testing" | "closed";

const PRESETS: Record<TicketPreset, {
  title: string;
  description: string;
  filters: Record<string, string | boolean>;
  icon: ReactNode;
}> = {
  all: {
    title: "All Tickets",
    description: "Assigned operational tickets across bug, service and access requests.",
    filters: { assigned: true, terminal: false },
    icon: <LifeBuoy className="size-4" aria-hidden />,
  },
  unassigned: {
    title: "Unassigned Tickets",
    description: "Manual and email-created tickets waiting for review and routing.",
    filters: { unassigned: true, terminal: false },
    icon: <Inbox className="size-4" aria-hidden />,
  },
  bugs: {
    title: "Bug Requests",
    description: "Bug tickets using the existing bug workflow.",
    filters: { ticket_type: "BUG" },
    icon: <AlertTriangle className="size-4" aria-hidden />,
  },
  services: {
    title: "Service Requests",
    description: "Operational requests such as logins, resets, installs and user support.",
    filters: { ticket_type: "SERVICE_REQUEST" },
    icon: <ClipboardList className="size-4" aria-hidden />,
  },
  access: {
    title: "Access Requests",
    description: "Security-controlled permission requests that require approval before implementation.",
    filters: { ticket_type: "ACCESS_REQUEST" },
    icon: <KeyRound className="size-4" aria-hidden />,
  },
  closed: {
    title: "Closed Tickets",
    description: "Closed or rejected tickets retained for audit.",
    filters: { terminal: true },
    icon: <Archive className="size-4" aria-hidden />,
  },
  critical: {
    title: "Critical Tickets",
    description: "Critical priority tickets across all request types.",
    filters: { critical: true, terminal: false },
    icon: <AlertOctagon className="size-4" aria-hidden />,
  },
  overdue: {
    title: "Overdue Tickets",
    description: "Tickets past their expected closure date.",
    filters: { overdue: true, terminal: false },
    icon: <AlertTriangle className="size-4" aria-hidden />,
  },
  testing: {
    title: "Testing / Verification",
    description: "Rectified and reopened tickets awaiting verification.",
    filters: { verification_queue: true },
    icon: <FlaskConical className="size-4" aria-hidden />,
  },
};

function pretty(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "-";
}

function TypeBadge({ type }: { type: string }) {
  const tone = type === "ACCESS_REQUEST"
    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    : type === "SERVICE_REQUEST"
      ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
      : type === "BUG"
        ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
        : "border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]";
  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium", tone)}>{pretty(type)}</span>;
}

function collapseWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function elapsedWorkTime(startedAt: string | null, now: number) {
  if (!startedAt) return "Active";
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return "Active";
  const seconds = Math.max(0, Math.floor((now - start) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function TicketWorkControl({
  row, now, presetKey, starting, canVerify, canRetake, onStart, onAction, onOpen,
}: {
  row: SupportTicketRow;
  now: number;
  presetKey: TicketPreset;
  starting: boolean;
  canVerify: boolean;
  canRetake: boolean;
  onStart: () => void;
  onAction: (action: WorkAction) => void;
  onOpen: () => void;
}) {
  const status = row.effective_status || row.status;
  const canStart = row.allowed_actions.includes("IN_PROGRESS");
  const workActions: { kind: WorkAction; label: string; hint: string; icon: ReactNode }[] = status === "IN_PROGRESS"
    ? [
        { kind: "pending", label: "Move to pending", hint: "Awaiting information", icon: <Pause /> },
        { kind: "hold", label: "Put on hold", hint: "Pause development", icon: <Pause /> },
        { kind: "rectify", label: "Rectified - send to testing", hint: "Ready for verification", icon: <FlaskConical /> },
      ]
    : [
        { kind: "rectify", label: "Rectified - send to testing", hint: "Ready for verification", icon: <FlaskConical /> },
      ];
  const availableActions = workActions.filter(({ kind }) => row.allowed_actions.includes(
    kind === "pending" ? "PENDING" : kind === "hold" ? "ON_HOLD" : "TESTING",
  ));

  if (status === "IN_PROGRESS" || status === "PENDING" || status === "ON_HOLD") {
    const active = status === "IN_PROGRESS";
    if (!canStart && availableActions.length === 0) {
      return (
        <button type="button" onClick={(event) => { event.stopPropagation(); onOpen(); }}
          className="ticket-work-pill"
          title={active ? "View work in progress" : "View paused ticket"}>
          <span className="ticket-work-ring" aria-hidden="true"><span /></span>
          <span className="ticket-work-pill-text">{active ? elapsedWorkTime(row.current_work_started_at, now) : status === "PENDING" ? "Pending" : "On hold"}</span>
          <ChevronDown className="ticket-work-caret" aria-hidden="true" />
        </button>
      );
    }
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" onClick={(event) => event.stopPropagation()}
            className="ticket-work-pill"
            aria-label={active ? `Work in progress for ${row.reference}. Change status` : `Paused work on ${row.reference}. Change status`}
            title={active ? "Work in progress - change status" : "Paused - change status"}>
            <span className="ticket-work-ring" aria-hidden="true"><span /></span>
            <span className="ticket-work-pill-text">{active ? elapsedWorkTime(row.current_work_started_at, now) : status === "PENDING" ? "Pending" : "On hold"}</span>
            <ChevronDown className="ticket-work-caret" aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={8} collisionPadding={12} className="ticket-work-popover">
            <div className="ticket-work-popover-head">
              <span>WORK SESSION</span>
              <span className="ticket-work-live"><i />{active ? "IN PROGRESS" : status === "PENDING" ? "PENDING" : "ON HOLD"}</span>
            </div>
            <div className="ticket-work-display">
              <span className="ticket-work-display-ring" aria-hidden="true"><span /></span>
              <div className="ticket-work-display-time">
                <strong>{active ? elapsedWorkTime(row.current_work_started_at, now) : status === "PENDING" ? "Pending" : "On hold"}</strong>
                <span>{active ? "Elapsed work time" : "Work is paused"}</span>
              </div>
            </div>
            <DropdownMenu.Separator className="ticket-work-divider" />
            <DropdownMenu.Label className="ticket-work-menu-label">CHANGE STATUS</DropdownMenu.Label>
            {!active && canStart ? (
              <DropdownMenu.Item onSelect={onStart}
                className="ticket-work-menu-item">
                <span className="ticket-work-menu-icon"><Play className="size-4" /></span>
                <span><span className="ticket-work-menu-title">Resume work</span><span className="ticket-work-menu-hint">Continue development</span></span>
              </DropdownMenu.Item>
            ) : null}
            {availableActions.map((action) => (
              <DropdownMenu.Item key={action.kind} onSelect={() => onAction(action.kind)}
                className="ticket-work-menu-item">
                <span className="ticket-work-menu-icon">{action.icon}</span>
                <span><span className="ticket-work-menu-title">{action.label}</span><span className="ticket-work-menu-hint">{action.hint}</span></span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  }

  if (["NEW", "CONFIRMED", "ASSIGNED", "APPROVED"].includes(status) && canStart) {
    return (
      <button type="button" disabled={starting} onClick={(event) => { event.stopPropagation(); onStart(); }}
        className="ticket-work-pill"
        title={`Start work on ${row.reference}`}>
        <span className="ticket-work-ring ticket-work-ring-start" aria-hidden="true"><Play className="size-3 fill-current" /></span>
        <span className="ticket-work-pill-text">{starting ? "Starting..." : "Start work"}</span>
      </button>
    );
  }

  if (["TESTING", "REOPENED"].includes(status) && presetKey === "testing" && canVerify) {
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" className="ticket-work-pill"
            aria-label={`Verification actions for ${row.reference}`}>
            <span className="ticket-work-ring ticket-work-ring-start" aria-hidden="true"><FlaskConical className="size-3.5" /></span>
            <span className="ticket-work-pill-text">{status === "REOPENED" ? "Review reopen" : "Verify"}</span>
            <ChevronDown className="ticket-work-caret" aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={8} collisionPadding={12} className="ticket-work-popover">
            <DropdownMenu.Label className="ticket-work-menu-label">VERIFICATION</DropdownMenu.Label>
            <DropdownMenu.Item onSelect={() => onAction("return")} className="ticket-work-menu-item">
              <span className="ticket-work-menu-icon"><RotateCcw /></span>
              <span><span className="ticket-work-menu-title">Send back to developer</span><span className="ticket-work-menu-hint">Describe what needs another fix</span></span>
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => onAction("close")} className="ticket-work-menu-item">
              <span className="ticket-work-menu-icon"><CheckCircle2 /></span>
              <span><span className="ticket-work-menu-title">Verified - close ticket</span><span className="ticket-work-menu-hint">Record the verification and close</span></span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  }

  const label = status === "TESTING" ? "Under Review"
    : status === "REOPENED" ? (presetKey === "testing" ? "Review reopen" : "View")
      : ["CLOSED", "REJECTED"].includes(status) ? "View" : "Open";
  if (status === "TESTING" || (status === "REOPENED" && presetKey === "testing")) {
    return <button type="button" className="ticket-work-pill" title={`${label} ${row.reference}`}
      onClick={(event) => {
        event.stopPropagation();
        if (status === "TESTING" && canRetake) onAction("retake");
        else onOpen();
      }}>
      <span className="ticket-work-ring ticket-work-ring-start" aria-hidden="true"><FlaskConical className="size-3.5" /></span>
      <span className="ticket-work-pill-text">{label}</span>
    </button>;
  }
  return <Button size="sm" variant={label === "View" ? "ghost" : "outline"}
    onClick={(event) => { event.stopPropagation(); onOpen(); }}>{label}</Button>;
}

export function TicketListPage({ presetKey = "all" }: { presetKey?: TicketPreset }) {
  const { can, hasRole, user } = useAuth();
  const companies = useCompanies();
  const isDeveloper = hasRole("DEVELOPER");
  const queryClient = useQueryClient();
  const preset = PRESETS[presetKey] ?? PRESETS.all;
  const personalView = presetKey === "all" && !can("tickets.ticket.view_all") && !can("tickets.ticket.classify") && !can("tickets.ticket.assign");
  const isUnassigned = presetKey === "unassigned";
  const [compactIntake, setCompactIntake] = useState(true);
  const [intakeColumns, setIntakeColumns] = useState(["title", "reported_by_name", "ticket_type", "original_mail_received_at", "actions"]);
  const [reviewTicketId, setReviewTicketId] = useState<string | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<SupportTicketRow | null>(null);
  const [ticketNotATicket, setTicketNotATicket] = useState<SupportTicketRow | null>(null);
  const [attachmentTicket, setAttachmentTicket] = useState<SupportTicketRow | null>(null);
  const [ticketToStart, setTicketToStart] = useState<SupportTicketRow | null>(null);
  const [editingWork, setEditingWork] = useState<SupportTicketRow | null>(null);
  const canViewAttachments = can("bugs.attachment.view");
  // Seeded from ?ticket= so an old /tickets/detail/:id link opens the dialog.
  const [detailTicketId, setDetailTicketId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("ticket"),
  );
  const [requestedAction, setRequestedAction] = useState<WorkAction | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (isUnassigned) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isUnassigned]);
  const { filters, setFilters, clearFilters, activeCount } = useUrlFilters({ ordering: "-created_at", limit: isUnassigned ? 6 : 25 });
  const selectedIntakeView = intakeView(filters.intake_view);
  const queryParams = useMemo(() => isUnassigned ? intakeParams(filters, selectedIntakeView) : ({ ...filters, ...preset.filters, submodule: presetKey }), [filters, preset.filters, presetKey, isUnassigned, selectedIntakeView]);
  const intakeCounts = useQueries({ queries: isUnassigned ? intakeViews.map((view) => {
    const params = intakeParams({ ...filters, ticket_type: "", needs_review: undefined, page: 1, limit: 1 }, view.key);
    return { queryKey: queryKeys.tickets.list(params), queryFn: () => ticketApi.list(params), staleTime: 30_000, refetchInterval: 30_000, select: (response: { count: number }) => response.count };
  }) : [] });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.tickets.list(queryParams),
    queryFn: () => ticketApi.list(queryParams),
    placeholderData: (previous) => previous,
    refetchInterval: 30_000,
  });
  const deleteTicket = useMutation({
    mutationFn: ({ row, payload }: { row: SupportTicketRow; payload: TicketRemovalPayload }) =>
      ticketApi.delete(row.id, payload),
    onSuccess: (result, { payload }) => {
      setTicketToDelete(null);
      setTicketNotATicket(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.sidebarCounts });
      if (payload.disposition === "NOT_A_TICKET") toast.success("Marked as Not a Ticket and removed");
      else if (result.notification_queued) toast.success("Ticket deleted. Deletion email queued.");
      else toast.warning("Ticket deleted. No email was queued; check the sender address and mail settings.");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not delete the ticket.")),
  });
  const deletingTicket = deleteTicket.isPending;
  const startWork = useMutation({
    mutationFn: (row: SupportTicketRow) => ticketApi.workTransition(row.id, { to_status: "IN_PROGRESS" }),
    onSuccess: async (_ticket, row) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
      setTicketToStart(null);
      toast.success(["PENDING", "ON_HOLD"].includes(row.effective_status || row.status) ? "Work resumed" : "Work started");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Unable to start work.")),
  });
  const startWorkIsPending = startWork.isPending;
  const startingTicketId = startWork.variables?.id;
  const resumingWork = ticketToStart !== null
    && ["PENDING", "ON_HOLD"].includes(ticketToStart.effective_status || ticketToStart.status);

  function openTicket(id: string, action: WorkAction | null = null) {
    setRequestedAction(action);
    setDetailTicketId(id);
  }

  /* The unassigned queue answers a different question from every other list:
     not "where is this ticket up to" but "what came in, from whom, and how long
     has it been sitting". Status, owner, project and priority are all blank or
     identical here by definition, so they are replaced by intake detail. */
  const unassignedColumns = useMemo<Column<SupportTicketRow>[]>(() => [
    {
      key: "title",
      header: "Request",
      sortable: true,
      width: intakeColumns.includes("description") ? "w-[22%]" : "w-[39%]",
      cell: (row) => <div className="intake-request">
        <button type="button" className="intake-request-title" title={row.title} onClick={() => setReviewTicketId(row.id)}>{row.title}</button>
        <div className="intake-request-meta"><span className="font-mono">{row.ref_no}</span>
          {user?.is_superuser && row.company ? <span>{row.company.name}</span> : null}
          {canViewAttachments && (row.email_attachment_count ?? 0) > 0 ? <button type="button"
            title="View email attachments" aria-label={`View ${row.email_attachment_count} email attachments for ${row.ref_no}`}
            onClick={() => setAttachmentTicket(row)}><Paperclip aria-hidden />{row.email_attachment_count}</button> : null}
        </div>
      </div>,
    },
    {
      key: "description",
      header: "Description",
      width: "w-[28%]",
      cell: (row) => <TicketEmailDescription ticket={row} />,
    },
    {
      key: "reported_by_name",
      header: "Received from",
      width: intakeColumns.includes("description") ? "w-[17%]" : "w-[23%]",
      cell: (row) => <IntakeSender ticket={row} />,
    },
    {
      key: "ticket_type",
      header: "Classification",
      width: intakeColumns.includes("description") ? "w-[11%]" : "w-[14%]",
      cell: (row) => <div className="intake-classification"><IntakeType type={row.ticket_type} /><IntakeSource source={row.source} /></div>,
    },
    {
      // The original-mail timestamp is annotated by the ticket queryset.
      key: "original_mail_received_at",
      header: "Received",
      sortable: true,
      width: intakeColumns.includes("description") ? "w-[14%]" : "w-[17%]",
      cell: (row) => <div className="intake-received"><IntakeReceived ticket={row} /><IntakeWaiting days={row.age_days} /></div>,
    },
    {
      key: "actions",
      header: "",
      align: "center",
      width: intakeColumns.includes("description") ? "w-[8%]" : "w-[7%]",
      cell: (row) => (
        <div className="intake-row-actions">
          <IconButton label={`Review ${row.ref_no}`} variant="outline" onClick={() => setReviewTicketId(row.id)}><ArrowUpRight /></IconButton>
        </div>
      ),
    },
  ], [canViewAttachments, user?.is_superuser, intakeColumns]);

  const columns = useMemo<Column<SupportTicketRow>[]>(() => [
    {
      key: "ticket_no",
      header: "Ticket",
      sortable: true,
      width: "w-36",
      cell: (row) => (
        <button
          type="button"
          className="whitespace-nowrap font-mono text-[12px] font-semibold text-[var(--primary)] hover:underline"
          onClick={(event) => {
            event.stopPropagation();
            openTicket(row.id);
          }}
        >
          {row.reference}
        </button>
      ),
    },
    {
      key: "title",
      header: "Request",
      sortable: true,
      width: "w-64",
      cell: (row) => (
        <div className="min-w-0">
          <TruncatedCell maxWidth="max-w-[240px]" className="font-medium">{row.title}</TruncatedCell>
          <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
            {row.reported_by_name || row.reported_by?.name || row.reported_by_email || "Unknown requester"}
          </p>
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      width: "w-72",
      hideBelow: "xl",
      cell: (row) => (
        <TruncatedCell maxWidth="max-w-[280px]" className="text-[var(--muted-foreground)]">
          {collapseWhitespace(row.description) || "-"}
        </TruncatedCell>
      ),
    },
    {
      key: "ticket_type",
      header: "Type",
      width: "w-40",
      cell: (row) => <TypeBadge type={row.ticket_type} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      width: "w-40",
      cell: (row) => (
        <div className="flex flex-col items-start gap-0.5">
          <TicketStatusBadge status={row.effective_status || row.status} />
          {isDeveloper && row.owner?.id === user?.id && (row.effective_status || row.status) === "IN_PROGRESS" ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
              <PlayCircle className="size-3" /> Working now
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      width: "w-24",
      hideBelow: "lg",
      cell: (row) => (
        <span className="text-[12px] text-[var(--muted-foreground)]">{pretty(row.source)}</span>
      ),
    },
    {
      key: "project",
      header: "Project / Module",
      hideBelow: "xl",
      cell: (row) => (
        <TruncatedCell maxWidth="max-w-[170px]">
          {[row.project?.name, row.module?.name].filter(Boolean).join(" / ") || "-"}
        </TruncatedCell>
      ),
    },
    {
      key: "owner",
      header: "Assigned to",
      width: "w-40",
      hideBelow: "md",
      cell: (row) => row.owner
        ? <TruncatedCell maxWidth="max-w-[150px]">{row.owner.name}</TruncatedCell>
        : <span className="text-[12px] text-[var(--muted-foreground)]">Unassigned</span>,
    },
    {
      key: "priority",
      header: "Priority",
      width: "w-28",
      hideBelow: "lg",
      cell: (row) => row.priority
        ? <PriorityBadge code={row.priority.code} label={row.priority.name} />
        : <span className="text-[var(--muted-foreground)]">-</span>,
    },
    {
      key: "age_days",
      header: "Age",
      sortable: true,
      width: "w-20",
      hideBelow: "md",
      cell: (row) => <span className="text-[12px] tabular-nums">{row.age_days}d</span>,
    },
    {
      key: "expected_closure_date",
      header: "Expected",
      sortable: true,
      width: "w-32",
      hideBelow: "lg",
      /* An expired date turns red rather than growing a "late" badge beside it:
         the date is already the thing being read, so colouring it says the same
         thing without widening the column. */
      cell: (row) => {
        const due = row.effective_expected_closure_date || row.expected_closure_date;
        if (!due) return <span className="text-[var(--muted-foreground)]">—</span>;
        return (
          <span
            className={cn(
              "text-[12px]",
              row.is_overdue
                ? "font-semibold text-[var(--destructive)]"
                : "text-[var(--muted-foreground)]",
            )}
            title={row.is_overdue ? `${row.overdue_days}d late` : undefined}
          >
            {formatDate(due)}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-40",
      // Portal clicks still bubble through React to the table row. Keep menu
      // and confirmation clicks from opening the ticket details as well.
      cell: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <TicketWorkControl
            row={row}
            now={now}
            presetKey={presetKey}
            starting={startWorkIsPending && startingTicketId === row.id}
            canVerify={can("tickets.ticket.verify_close") && can("tickets.ticket.add_update")}
            canRetake={isDeveloper && row.owner?.id === user?.id && !row.needs_review
              && row.allowed_actions.includes("IN_PROGRESS") && can("tickets.ticket.add_update")}
            onStart={() => setTicketToStart(row)}
            onAction={(action) => openTicket(row.id, action)}
            onOpen={() => openTicket(row.id)}
          />
          {row.can_edit_details ? <IconButton label="Edit work details" onClick={() => setEditingWork(row)}>
            <Pencil className="size-4" />
          </IconButton> : null}
        </div>
      ),
    },
  ], [presetKey, isDeveloper, user?.id, can, now, startWorkIsPending, startingTicketId]);

  return (
    <div className={isUnassigned ? cn("ticket-intake-focus", compactIntake && "intake-density-compact", intakeColumns.includes("description") && "intake-with-description", user?.is_superuser && "intake-multi-company") : undefined}>
      <PageHeader
        className={isUnassigned ? "intake-page-heading" : undefined}
        title={isUnassigned ? "Unassigned tickets" : personalView ? "My Tickets" : preset.title}
        description={isUnassigned ? `${intakeCounts[0]?.data ?? data?.count ?? 0} requests awaiting review · ${user?.is_superuser ? (companies.data?.find((company) => company.id === filters.company)?.name || "All companies") : user?.company?.name || "Your company"}` : personalView ? "Requests assigned to you or reported by you." : preset.description}
        breadcrumbs={[{ label: isUnassigned ? "Ticket creation" : "Ticket Management" }, { label: isUnassigned ? "Unassigned" : preset.title }]}
        actions={isUnassigned ? <><div className="intake-density" role="group" aria-label="Row density">
          <button type="button" title="Comfortable rows" aria-label="Comfortable rows" aria-pressed={!compactIntake} onClick={() => setCompactIntake(false)}><LayoutList />{!compactIntake ? <CheckCircle2 className="intake-density-check" aria-hidden /> : null}</button>
          <button type="button" title="Compact rows" aria-label="Compact rows" aria-pressed={compactIntake} onClick={() => setCompactIntake(true)}><Rows3 />{compactIntake ? <CheckCircle2 className="intake-density-check" aria-hidden /> : null}</button>
        </div></> : (
          <Button variant="outline" size="sm" onClick={clearFilters} disabled={activeCount === 0}>
            <ListFilter /> Clear filters
          </Button>
        )}
      />

      {isUnassigned ? <div className="intake-tabs" role="tablist" aria-label="Intake stage">{intakeViews.map((view, index) => <button key={view.key} type="button" role="tab"
        id={`intake-tab-${view.key}`} aria-controls="intake-results" aria-selected={view.key === selectedIntakeView} tabIndex={view.key === selectedIntakeView ? 0 : -1}
        onKeyDown={(event) => {
          const next = event.key === "ArrowRight" ? (index + 1) % intakeViews.length : event.key === "ArrowLeft" ? (index + intakeViews.length - 1) % intakeViews.length : event.key === "Home" ? 0 : event.key === "End" ? intakeViews.length - 1 : -1;
          if (next < 0) return;
          event.preventDefault(); setFilters({ intake_view: intakeViews[next].key, ticket_type: "", needs_review: "" }); document.getElementById(`intake-tab-${intakeViews[next].key}`)?.focus();
        }} onClick={() => setFilters({ intake_view: view.key, ticket_type: "", needs_review: "" })}>{view.label}<span>{intakeCounts[index]?.data ?? "-"}</span></button>)}</div> : null}
      <div className={isUnassigned ? "intake-shell" : "zcard overflow-hidden"}>
        {user?.is_superuser && !isUnassigned ? <div className="border-b border-[var(--border)] p-3">
          <Select className="max-w-xs" aria-label="Company" value={(filters.company as string) ?? ""}
            onChange={(event) => setFilters({ company: event.target.value })}>
            <option value="">All companies</option>{(companies.data ?? []).map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </Select>
        </div> : null}
        <div
          className={cn(
            "grid gap-3 border-b border-[var(--border)] p-3",
            isUnassigned
              ? "intake-filters"
              : "md:grid-cols-[minmax(240px,1fr)_170px_150px_170px]",
          )}
        >
          {isUnassigned ? <div className="intake-search"><Search aria-hidden /><Input type="search" placeholder="Search subject, sender or reference..." aria-label="Search tickets"
            value={(filters.search as string) ?? ""} onChange={(event) => setFilters({ search: event.target.value })} /></div> : <Input
            type="search"
            className="h-9 min-w-0"
            placeholder="Search ticket, sender, subject..."
            aria-label="Search tickets"
            value={(filters.search as string) ?? ""}
            onChange={(event) => setFilters({ search: event.target.value })}
          />}
          {isUnassigned && user?.is_superuser ? <Select aria-label="Company" value={(filters.company as string) ?? ""}
            onChange={(event) => setFilters({ company: event.target.value })}>
            <option value="">All companies</option>{(companies.data ?? []).map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </Select> : null}
          <Select
            value={(filters.ticket_type as string) ?? ""}
            onChange={(event) => setFilters({ ticket_type: event.target.value, ...(isUnassigned ? { intake_view: "all", needs_review: "" } : {}) })}
            disabled={Boolean(preset.filters.ticket_type)}
            aria-label="Ticket type"
          >
            <option value="">All types</option>
            <option value="BUG">Bug</option>
            <option value="SERVICE_REQUEST">Service Request</option>
            <option value="ACCESS_REQUEST">Access Request</option>
            <option value="UNKNOWN">Unknown</option>
          </Select>
          <Select
            value={(filters.source as string) ?? ""}
            onChange={(event) => setFilters({ source: event.target.value })}
            disabled={Boolean(preset.filters.source)}
            aria-label="Ticket source"
          >
            <option value="">All sources</option>
            <option value="MANUAL">Manual</option>
            <option value="EMAIL">Email</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="IN_PERSON">In Person</option>
          </Select>
          {isUnassigned ? (
            <>
              <Select aria-label="Sort requests" value={filters.ordering} onChange={(event) => setFilters({ ordering: event.target.value })}>
                <option value="-created_at">Newest first</option><option value="created_at">Oldest first</option><option value="title">Subject A - Z</option><option value="-age_days">Longest waiting</option>
              </Select>
              <Button variant="ghost" size="sm" className="h-9" title="Reset filters" aria-label="Reset filters" onClick={clearFilters}>
                <RotateCcw />
              </Button>
            </>
          ) : null}
          {!isUnassigned ? (
            <Select
              value={(filters.status as string) ?? ""}
              onChange={(event) => setFilters({ status: event.target.value })}
              disabled={Boolean(preset.filters.status)}
              aria-label="Ticket status"
            >
              <option value="">All statuses</option>
              {[
                "NEW", "NEEDS_REVIEW", "CONFIRMED", "ASSIGNED", "IN_PROGRESS",
                "PENDING_APPROVAL", "APPROVED", "TESTING", "RESOLVED", "REOPENED",
                "COMPLETED", "CLOSED", "REJECTED",
              ].map((status) => <option key={status} value={status}>{pretty(status)}</option>)}
            </Select>
          ) : null}
        </div>

        <div className={isUnassigned ? "intake-results" : undefined} id={isUnassigned ? "intake-results" : undefined} role={isUnassigned ? "tabpanel" : undefined} aria-labelledby={isUnassigned ? `intake-tab-${selectedIntakeView}` : undefined}>
        {isUnassigned ? <div className="intake-table-heading"><span><Inbox aria-hidden /> Incoming requests <strong>{data?.count ?? 0}</strong></span>
          <div className="intake-table-tools"><span>{filters.ordering === "created_at" ? "Oldest first" : filters.ordering === "title" ? "Subject A - Z" : filters.ordering === "-age_days" ? "Longest waiting" : "Newest first"}</span>
          <DropdownMenu.Root><DropdownMenu.Trigger asChild><IconButton label="Visible columns"><Columns3 /></IconButton></DropdownMenu.Trigger><DropdownMenu.Portal>
            <DropdownMenu.Content className="intake-columns-menu" align="end" sideOffset={6}><DropdownMenu.Label>Visible columns</DropdownMenu.Label>
              {unassignedColumns.filter((column) => !["title", "actions"].includes(column.key)).map((column) => <DropdownMenu.CheckboxItem key={column.key} checked={intakeColumns.includes(column.key)}
                onSelect={(event) => event.preventDefault()} onCheckedChange={(checked) => setIntakeColumns((current) => checked ? [...current, column.key] : current.filter((key) => key !== column.key))}>
                <span><DropdownMenu.ItemIndicator><CheckCircle2 /></DropdownMenu.ItemIndicator></span>{column.header}</DropdownMenu.CheckboxItem>)}
            </DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div>
        </div> : null}
        {isError ? <ErrorState onRetry={() => refetch()} /> : (
          <>
            <DataTable
              columns={isUnassigned ? unassignedColumns : columns}
              visibleColumns={isUnassigned ? intakeColumns : undefined}
              layout={isUnassigned ? "fit" : "scroll"}
              stickyHeader={!isUnassigned}
              rows={data?.results ?? []}
              rowKey={(row) => row.id}
              rowClassName={(row) => isDeveloper && row.owner?.id === user?.id && (row.effective_status || row.status) === "IN_PROGRESS"
                ? "border-l-2 border-l-indigo-500 bg-indigo-50/70 hover:bg-indigo-100/70 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30"
                : (row.effective_status || row.status) === "TESTING"
                ? "border-l-2 border-l-teal-500/70 bg-teal-50/70 hover:bg-teal-100/70 dark:bg-teal-950/20 dark:hover:bg-teal-900/30"
                : (row.effective_status || row.status) === "REOPENED"
                  ? "border-l-2 border-l-amber-500/70 bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-950/20 dark:hover:bg-amber-900/30"
                  : undefined}
              isLoading={isLoading}
              ordering={filters.ordering}
              onOrderingChange={(ordering) => setFilters({ ordering }, { resetPage: false })}
              onRowClick={isUnassigned ? undefined : (row) => openTicket(row.id)}
              emptyTitle={isUnassigned ? "Nothing waiting" : "No tickets found"}
              emptyDescription={
                isUnassigned
                  ? "Every incoming request has been reviewed and routed."
                  : "Nothing matches this ticket view."
              }
            />
            {data && data.count > 0 ? (
              <div className={isUnassigned ? "intake-pagination" : undefined}><Pagination
                page={data.page}
                totalPages={data.total_pages}
                count={data.count}
                pageSize={filters.limit}
                pageSizeOptions={isUnassigned ? [6, 12, 25, 50] : undefined}
                onPageChange={(page) => setFilters({ page }, { resetPage: false })}
                onPageSizeChange={(limit) => setFilters({ limit })}
              /></div>
            ) : null}
          </>
        )}
        </div>
      </div>

      {detailTicketId !== null ? (
        <Suspense fallback={<div className="fixed inset-0 z-50 grid place-items-center bg-black/30" role="status" aria-label="Loading ticket"><Spinner className="size-6 text-white" /></div>}>
          <TicketDetailDialog
            open
            onOpenChange={(next) => {
              if (!next) {
                setDetailTicketId(null);
                setRequestedAction(null);
              }
            }}
            ticketId={detailTicketId}
            showVerifyClose={presetKey === "testing"}
            initialAction={requestedAction}
          />
        </Suspense>
      ) : null}

      {isUnassigned ? (
        <ReviewAssignDialog
          open={reviewTicketId !== null}
          onOpenChange={(next) => (next ? null : setReviewTicketId(null))}
          ticket={(data?.results ?? []).find((row) => row.id === reviewTicketId) ?? null}
          onNotATicket={setTicketNotATicket}
          onDelete={setTicketToDelete}
        />
      ) : null}

      {(editingWork || (ticketToStart && !resumingWork)) ? <WorkDetailsDialog
        key={`${editingWork?.id ?? ticketToStart?.id}-${editingWork ? "edit" : "start"}`}
        ticket={editingWork ?? ticketToStart} mode={editingWork ? "edit" : "start"}
        onClose={() => { setEditingWork(null); setTicketToStart(null); }} /> : null}
      <ConfirmDialog
        open={ticketToStart !== null && resumingWork}
        onOpenChange={(open) => { if (!open && !startWork.isPending) setTicketToStart(null); }}
        title={resumingWork ? "Resume work on this ticket?" : "Start work on this ticket?"}
        description={`${ticketToStart?.reference ?? "This ticket"}${ticketToStart ? ` · ${ticketToStart.title}` : ""} will move to In Progress and ${resumingWork ? "resume" : "start"} the work timer.`}
        confirmLabel={resumingWork ? "Resume work" : "Start work"}
        loading={startWork.isPending}
        onConfirm={() => { if (ticketToStart && !startWork.isPending) startWork.mutate(ticketToStart); }}
      />

      <ConfirmDialog
        open={ticketNotATicket !== null}
        onOpenChange={(open) => { if (!open && !deletingTicket) setTicketNotATicket(null); }}
        title="Mark as Not a Ticket?"
        description={`${ticketNotATicket?.ref_no ?? "This request"}${ticketNotATicket ? ` · ${ticketNotATicket.title}` : ""} will be removed from Unassigned Tickets. Its history will be retained for audit. No deletion email will be sent to the sender.`}
        confirmLabel="Not a Ticket"
        destructive
        loading={deletingTicket}
        onConfirm={() => { if (ticketNotATicket && !deletingTicket) deleteTicket.mutate({ row: ticketNotATicket, payload: { disposition: "NOT_A_TICKET" } }); }}
      />
      {ticketToDelete ? (
        <DeleteUnassignedTicketDialog key={ticketToDelete.id} ticket={ticketToDelete}
          pending={deleteTicket.isPending} onClose={() => setTicketToDelete(null)}
          onDelete={(reason) => deleteTicket.mutate({ row: ticketToDelete, payload: { disposition: "DELETE", reason } })} />
      ) : null}
      {attachmentTicket ? (
        <Modal open onOpenChange={(open) => { if (!open) setAttachmentTicket(null); }}
          title={`Email attachments · ${attachmentTicket.ref_no}`} description={attachmentTicket.title} size="lg">
          <EmailAttachmentList ticketId={attachmentTicket.id} />
        </Modal>
      ) : null}
    </div>
  );
}
