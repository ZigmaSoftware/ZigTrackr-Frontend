import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  AlertOctagon, AlertTriangle, Archive, ChevronDown, FlaskConical, Inbox, Pause,
  Play, PlayCircle, KeyRound, LifeBuoy, ListFilter, ClipboardList, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ticketApi } from "@/api/services";
import { apiErrorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { PageHeader } from "@/components/common/PageHeader";
import { Button, Card, IconButton, Input, Select, Spinner } from "@/components/ui/primitives";
import { DataTable, TruncatedCell, type Column } from "@/components/tables/DataTable";
import { Pagination } from "@/components/tables/Pagination";
import { ErrorState } from "@/components/feedback/states";
import { ConfirmDialog } from "@/components/feedback/Modal";
import { formatDate, formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/AuthContext";
import type { SupportTicketRow } from "@/types";
import { PriorityBadge } from "@/components/common/badges";
import { ReviewAssignDialog } from "@/features/tickets/dialogs/ReviewAssignDialog";
import { DescriptionPreview, RequestPreview, TicketStatusBadge } from "@/features/tickets/TicketTableCells";
import "./TicketWorkControl.css";

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

/* Source is the one thing in this queue that changes how you read the row -- an
   email has a sender and an arrival time, a walk-up has neither -- so it earns
   colour. The rest of the row stays monochrome. */
function SourceBadge({ source }: { source: string }) {
  const tone = source === "EMAIL"
    ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
    : source === "WHATSAPP"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : source === "IN_PERSON"
        ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
        : "border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]";
  const label = source === "IN_PERSON" ? "In person"
    : source === "WHATSAPP" ? "WhatsApp"
      : source === "EMAIL" ? "Email" : pretty(source);
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium", tone)}>
      {label}
    </span>
  );
}

function ReceivedFrom({ row }: { row: SupportTicketRow }) {
  const name = row.reported_by_name || row.reported_by?.name || "";
  const email = row.reported_by_email || row.mail_from_email || "";

  if (!name && !email) {
    return <span className="text-[12px] text-[var(--muted-foreground)]">Unknown sender</span>;
  }
  return (
    <div className="min-w-0">
      <TruncatedCell maxWidth="max-w-[200px]" className="font-medium">
        {name || email}
      </TruncatedCell>
      {name && email ? (
        <TruncatedCell maxWidth="max-w-[200px]" className="text-[11px] text-[var(--muted-foreground)]">
          {email}
        </TruncatedCell>
      ) : null}
    </div>
  );
}

function MailedDate({ row }: { row: SupportTicketRow }) {
  /* Manual tickets never had a mail, so the creation time is the honest answer
     -- marked, so nobody reads it as a send time. */
  const mailed = row.mail_received_at;
  return (
    <div className="min-w-0">
      <span className="text-[12px] text-[var(--foreground)]">
        {formatDateTime(mailed || row.created_at)}
      </span>
      {mailed ? null : (
        <p className="text-[11px] text-[var(--muted-foreground)]">logged</p>
      )}
    </div>
  );
}

/* Age is the queue's real priority signal, so it is the one number allowed to
   raise its voice -- and only once it is genuinely old. */
function AgeCell({ days }: { days: number }) {
  const tone = days >= 7
    ? "text-[var(--destructive)] font-semibold"
    : days >= 3
      ? "text-amber-600 dark:text-amber-400 font-medium"
      : "text-[var(--muted-foreground)]";
  return <span className={cn("text-[12px] tabular-nums", tone)}>{days}d</span>;
}

type WorkAction = "pending" | "hold" | "rectify";

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
  row, now, presetKey, starting, onStart, onAction, onOpen,
}: {
  row: SupportTicketRow;
  now: number;
  presetKey: TicketPreset;
  starting: boolean;
  onStart: () => void;
  onAction: (action: WorkAction) => void;
  onOpen: () => void;
}) {
  const [confirmingAction, setConfirmingAction] = useState<WorkAction | null>(null);
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
    const confirmation = confirmingAction === "pending"
      ? { title: "Move ticket to Pending?", description: "This pauses the work timer. You can resume work when the ticket is ready.", confirm: "Continue to pending" }
      : confirmingAction === "hold"
        ? { title: "Put ticket On Hold?", description: "This pauses the work timer while development is on hold.", confirm: "Put on hold" }
        : { title: "Send ticket to Testing?", description: "This hands the corrected ticket to the testing team for verification.", confirm: "Send to testing" };

    return (
      <>
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
              <DropdownMenu.Item key={action.kind} onSelect={() => setConfirmingAction(action.kind)}
                className="ticket-work-menu-item">
                <span className="ticket-work-menu-icon">{action.icon}</span>
                <span><span className="ticket-work-menu-title">{action.label}</span><span className="ticket-work-menu-hint">{action.hint}</span></span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ConfirmDialog
        open={confirmingAction !== null}
        onOpenChange={(open) => { if (!open) setConfirmingAction(null); }}
        title={confirmation.title}
        description={confirmation.description}
        confirmLabel={confirmation.confirm}
        onConfirm={() => {
          const action = confirmingAction;
          setConfirmingAction(null);
          if (action) onAction(action);
        }}
      />
      </>
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

  const label = status === "TESTING" ? (presetKey === "testing" ? "Verify" : "Review fix")
    : status === "REOPENED" ? (presetKey === "testing" ? "Review reopen" : "View")
      : ["CLOSED", "REJECTED"].includes(status) ? "View" : "Open";
  if (status === "TESTING" || (status === "REOPENED" && presetKey === "testing")) {
    return <button type="button" className="ticket-work-pill" title={`${label} ${row.reference}`}
      onClick={(event) => { event.stopPropagation(); onOpen(); }}>
      <span className="ticket-work-ring ticket-work-ring-start" aria-hidden="true"><FlaskConical className="size-3.5" /></span>
      <span className="ticket-work-pill-text">{label}</span>
    </button>;
  }
  return <Button size="sm" variant={label === "View" ? "ghost" : "outline"}
    onClick={(event) => { event.stopPropagation(); onOpen(); }}>{label}</Button>;
}

export function TicketListPage({ presetKey = "all" }: { presetKey?: TicketPreset }) {
  const { can, hasRole, user } = useAuth();
  const isDeveloper = hasRole("DEVELOPER");
  const queryClient = useQueryClient();
  const preset = PRESETS[presetKey] ?? PRESETS.all;
  const personalView = presetKey === "all" && !can("tickets.ticket.view_all") && !can("tickets.ticket.classify") && !can("tickets.ticket.assign");
  const isUnassigned = presetKey === "unassigned";
  const [reviewTicketId, setReviewTicketId] = useState<string | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<SupportTicketRow | null>(null);
  const canDelete = can("tickets.ticket.delete");
  // Seeded from ?ticket= so an old /tickets/detail/:id link opens the dialog.
  const [detailTicketId, setDetailTicketId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("ticket"),
  );
  const [requestedAction, setRequestedAction] = useState<WorkAction | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const { filters, setFilters, clearFilters, activeCount } = useUrlFilters({ ordering: "-created_at" });
  const queryParams = useMemo(() => ({ ...filters, ...preset.filters, submodule: presetKey }), [filters, preset.filters, presetKey]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.tickets.list(queryParams),
    queryFn: () => ticketApi.list(queryParams),
    placeholderData: (previous) => previous,
    refetchInterval: 30_000,
  });
  const deleteTicket = useMutation({
    mutationFn: (id: string) => ticketApi.delete(id),
    onSuccess: () => {
      setTicketToDelete(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.sidebarCounts });
      toast.success("Ticket deleted");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not delete the ticket.")),
  });
  const startWork = useMutation({
    mutationFn: (row: SupportTicketRow) => ticketApi.workTransition(row.id, { to_status: "IN_PROGRESS" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
      toast.success("Work started");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Unable to start work.")),
  });
  const startWorkMutate = startWork.mutate;
  const startWorkIsPending = startWork.isPending;
  const startingTicketId = startWork.variables?.id;

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
      key: "ref_no",
      header: "Ref number",
      sortable: true,
      width: "w-36",
      cell: (row) => (
        <span className="font-mono text-[12px] font-semibold text-[var(--primary)] hover:underline">
          {row.ref_no}
        </span>
      ),
    },
    {
      key: "ticket_type",
      header: "Type",
      width: "w-32",
      cell: (row) => <TypeBadge type={row.ticket_type} />,
    },
    {
      key: "source",
      header: "Source",
      width: "w-28",
      cell: (row) => <SourceBadge source={row.source} />,
    },
    {
      key: "reported_by_name",
      header: "Received from",
      width: "w-56",
      cell: (row) => <ReceivedFrom row={row} />,
    },
    {
      key: "title",
      header: "Request",
      sortable: true,
      width: "w-[320px]",
      cell: (row) => <RequestPreview value={row.title} />,
    },
    {
      key: "description",
      header: "Description",
      width: "w-[390px]",
      hideBelow: "xl",
      cell: (row) => <DescriptionPreview value={row.description} />,
    },
    {
      // The original-mail timestamp is annotated by the ticket queryset.
      key: "original_mail_received_at",
      header: "Mailed date",
      sortable: true,
      width: "w-36",
      hideBelow: "lg",
      cell: (row) => <MailedDate row={row} />,
    },
    {
      key: "age_days",
      header: "Age",
      sortable: true,
      width: "w-20",
      cell: (row) => <AgeCell days={row.age_days} />,
    },
    ...(canDelete ? [{
      key: "actions",
      header: "",
      align: "center",
      width: "w-14",
      cell: (row) => row.can_delete ? (
        <div className="flex w-full justify-center">
          <IconButton
            label={`Delete ${row.ref_no}`}
            className="text-[var(--destructive)] hover:bg-red-500/10"
            onClick={(event) => {
              event.stopPropagation();
              setTicketToDelete(row);
            }}
          >
            <Trash2 />
          </IconButton>
        </div>
      ) : null,
    } satisfies Column<SupportTicketRow>] : []),
  ], [canDelete]);

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
      cell: (row) => <TicketWorkControl
        row={row}
        now={now}
        presetKey={presetKey}
        starting={startWorkIsPending && startingTicketId === row.id}
        onStart={() => startWorkMutate(row)}
        onAction={(action) => openTicket(row.id, action)}
        onOpen={() => openTicket(row.id)}
      />,
    },
  ], [presetKey, isDeveloper, user?.id, now, startWorkIsPending, startingTicketId, startWorkMutate]);

  return (
    <>
      <PageHeader
        title={personalView ? "My Tickets" : preset.title}
        description={personalView ? "Requests assigned to you or reported by you." : preset.description}
        breadcrumbs={[{ label: presetKey === "unassigned" ? "Ticket Creation" : "Ticket Management" }, { label: preset.title }]}
        actions={isUnassigned ? null : (
          <Button variant="outline" size="sm" onClick={clearFilters} disabled={activeCount === 0}>
            <ListFilter /> Clear filters
          </Button>
        )}
      />

      <Card className="overflow-hidden">
        <div
          className={cn(
            "grid gap-3 border-b border-[var(--border)] p-3",
            isUnassigned
              ? "md:grid-cols-[minmax(180px,1fr)_150px_140px_180px_96px]"
              : "md:grid-cols-[minmax(240px,1fr)_170px_150px_170px]",
          )}
        >
          <Input
            type="search"
            className="h-9 min-w-0"
            placeholder="Search ticket, sender, subject..."
            aria-label="Search tickets"
            value={(filters.search as string) ?? ""}
            onChange={(event) => setFilters({ search: event.target.value })}
          />
          <Select
            value={(filters.ticket_type as string) ?? ""}
            onChange={(event) => setFilters({ ticket_type: event.target.value })}
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
              <Input
                type="date"
                className="h-9 min-w-0"
                aria-label="Received date"
                title="Filter by received date"
                value={(filters.received_date as string) ?? ""}
                onChange={(event) => setFilters({ received_date: event.target.value })}
              />
              <Button variant="outline" size="sm" className="h-9" title="Clear filters" aria-label="Clear filters" onClick={clearFilters}>
                <ListFilter /> <span className="hidden lg:inline">Clear</span>
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

        {isError ? <ErrorState onRetry={() => refetch()} /> : (
          <>
            <DataTable
              columns={isUnassigned ? unassignedColumns : columns}
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
              onRowClick={(row) => (
                isUnassigned ? setReviewTicketId(row.id) : openTicket(row.id)
              )}
              emptyTitle={isUnassigned ? "Nothing waiting" : "No tickets found"}
              emptyDescription={
                isUnassigned
                  ? "Every incoming request has been reviewed and routed."
                  : "Nothing matches this ticket view."
              }
            />
            {data && data.count > 0 ? (
              <Pagination
                page={data.page}
                totalPages={data.total_pages}
                count={data.count}
                pageSize={filters.limit}
                onPageChange={(page) => setFilters({ page }, { resetPage: false })}
                onPageSizeChange={(limit) => setFilters({ limit })}
              />
            ) : null}
          </>
        )}
      </Card>

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
        />
      ) : null}

      <ConfirmDialog
        open={ticketToDelete !== null}
        onOpenChange={(open) => { if (!open && !deleteTicket.isPending) setTicketToDelete(null); }}
        title="Delete unassigned ticket?"
        description={`${ticketToDelete?.ref_no ?? "This ticket"} will be removed from the review queue. Its history will be retained for audit.`}
        confirmLabel="Delete ticket"
        destructive
        loading={deleteTicket.isPending}
        onConfirm={() => { if (ticketToDelete) deleteTicket.mutate(ticketToDelete.id); }}
      />
    </>
  );
}
