import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Bot, CheckCircle2, ChevronDown, CircleAlert, FileText, FlaskConical, GitCommit,
  Image as ImageIcon, MessageSquare, MessageSquarePlus, Paperclip, PauseCircle, PlayCircle,
  RotateCcw, ShieldCheck, UserCheck, UserRoundCheck, X, XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { bugApi, ticketApi } from "@/api/services";
import { apiErrorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { ConfirmDialog, Modal } from "@/components/feedback/Modal";
import {
  Button, IconButton, Input, Label, Select, Skeleton, Textarea,
} from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { useAssignableUsers } from "@/hooks/useMasters";
import { useTicketSocket } from "@/hooks/useTicketSocket";
import { useAuth } from "@/features/auth/AuthContext";
import { formatDate, formatDateTime } from "@/lib/dates";
import { personWithRole } from "@/lib/personRole";
import { mergeChatMessages } from "@/lib/ticketChat";
import { TicketChat } from "@/components/chat/TicketChat";
import { AttachmentActions } from "@/components/attachments/AttachmentActions";
import { cn, formatBytes } from "@/lib/utils";
import type { RequestMessage, SupportTicketDetail, TicketChatMessage, TicketTimelineEvent } from "@/types";
import "./TicketDetailDialog.css";

function pretty(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "-";
}

type StatusAction = "start" | "retake" | "return" | "pending" | "hold" | "rectify" | "close" | "approve" | "reject";
type DialogKind = StatusAction | "assign" | "update";

/* The work-flow moves map onto one endpoint; approve and reject remain their
   own actions because they are access-request decisions, not work states. */
const WORK_TARGET: Partial<Record<DialogKind, string>> = {
  start: "IN_PROGRESS",
  retake: "IN_PROGRESS",
  return: "IN_PROGRESS",
  pending: "PENDING",
  hold: "ON_HOLD",
  rectify: "TESTING",
  close: "CLOSED",
};

export interface TicketDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string | null;
  showVerifyClose: boolean;
}

export function TicketDetailDialog({ open, onOpenChange, ticketId, showVerifyClose }: TicketDetailDialogProps) {
  const [action, setAction] = useState<DialogKind | null>(null);

  const { data: ticket, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.tickets.detail(ticketId ?? ""),
    queryFn: () => ticketApi.detail(ticketId!),
    enabled: open && Boolean(ticketId),
  });

  useEffect(() => {
    if (!open) setAction(null);
  }, [open]);

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay
            className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-[2px]
                       data-[state=open]:animate-in data-[state=open]:fade-in-0"
          />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-[60] flex h-[calc(100vh-3rem)] w-[calc(100vw-2rem)]
                       max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden
                       rounded-xl border border-[var(--border)] bg-[var(--card)]
                       shadow-[var(--shadow-pop)]
                       data-[state=open]:animate-in data-[state=open]:fade-in-0
                       data-[state=open]:zoom-in-95"
          >
            {isLoading || !ticket ? (
              <LoadingShell isError={isError} onRetry={() => refetch()} onClose={() => onOpenChange(false)} />
            ) : (
              <TicketDetailBody
                ticket={ticket}
                onClose={() => onOpenChange(false)}
                onAction={setAction}
                showVerifyClose={showVerifyClose}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Mounted outside the detail dialog's tree: Radix portals both, and a
          nested action dialog must be able to close without closing its parent. */}
      {ticket ? (
        <TicketActionDialog
          open={action !== null}
          kind={action}
          ticket={ticket}
          onOpenChange={(next) => (next ? null : setAction(null))}
          onStatusChanged={showVerifyClose ? () => onOpenChange(false) : undefined}
        />
      ) : null}
    </>
  );
}

function LoadingShell({
  isError, onRetry, onClose,
}: { isError: boolean; onRetry: () => void; onClose: () => void }) {
  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-3.5">
        <Dialog.Title className="text-[15px] font-semibold">Ticket</Dialog.Title>
        <IconButton label="Close dialog" onClick={onClose}><X /></IconButton>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {isError ? (
          <ErrorState onRetry={onRetry} />
        ) : (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12" />)}
          </div>
        )}
      </div>
    </>
  );
}

/* ---- HEADER + TABS ---- */

function TicketDetailBody({
  ticket, onClose, onAction, showVerifyClose,
}: {
  ticket: SupportTicketDetail;
  onClose: () => void;
  onAction: (kind: DialogKind) => void;
  showVerifyClose: boolean;
}) {
  const { user, can, hasRole } = useAuth();
  const [tab, setTab] = useState("timeline");

  const isOwner = ticket.owner?.id === user?.id;
  const canManage = can("tickets.ticket.mutate_all") || can("tickets.ticket.classify")
    || can("tickets.ticket.assign");
  const terminal = ["CLOSED", "REJECTED"].includes(ticket.status);

  const canAssign = !ticket.needs_review && !ticket.owner && !terminal
    && can("tickets.ticket.assign");
  /* Once a bug exists the update belongs on the bug, not the ticket -- the
     service layer refuses the ticket route there. Both are offered under one
     button; TicketActionDialog picks the endpoint. */
  const canUpdate = !terminal && (isOwner || canManage) && (
    ticket.bug_id
      ? can("bugs.update.add")
      : ticket.ticket_type !== "BUG" && can("tickets.ticket.add_update")
  );
  const canWork = !ticket.needs_review && (isOwner || canManage) && can("tickets.ticket.add_update");

  /* The shared work flow, mirroring WORK_TRANSITIONS on the server: Start puts
     the ticket In Progress, from there it is parked or handed to a tester, and
     only someone who may close bugs closes it. The menu offers exactly the
     moves the API would accept, so it cannot present one that then fails. */
  const statusActions = useMemo(() => {
    const options: { kind: StatusAction; label: string; hint: string; icon: React.ReactNode }[] = [];
    const status = ticket.effective_status || ticket.status;
    const isAccess = ticket.ticket_type === "ACCESS_REQUEST";

    if (canWork && ticket.owner) {
      if (["NEW", "CONFIRMED", "ASSIGNED", "APPROVED"].includes(status)) {
        options.push({ kind: "start", label: "Start work", hint: "Mark this ticket in progress", icon: <PlayCircle /> });
      }
      if (status === "IN_PROGRESS") {
        options.push({ kind: "pending", label: "Move to pending", hint: "Pause while awaiting information", icon: <PauseCircle /> });
        options.push({ kind: "hold", label: "Put on hold", hint: "Pause development work", icon: <PauseCircle /> });
        options.push({ kind: "rectify", label: "Rectified - send to testing", hint: "Hand over for verification", icon: <FlaskConical /> });
      }
      if (status === "ON_HOLD" || status === "PENDING") {
        options.push({ kind: "start", label: "Resume work", hint: "Continue development", icon: <PlayCircle /> });
        options.push({ kind: "rectify", label: "Rectified - send to testing", hint: "Hand over for verification", icon: <FlaskConical /> });
      }
    }
    if (status === "TESTING" || status === "REOPENED") {
      if (showVerifyClose && can("tickets.ticket.verify_close")) {
        options.push({ kind: "return", label: "Send back to developer", hint: "Return for another fix", icon: <RotateCcw /> });
        options.push({ kind: "close", label: "Verified - close ticket", hint: "Complete verification", icon: <CheckCircle2 /> });
      } else if (status === "TESTING" && !showVerifyClose && isOwner && hasRole("DEVELOPER") && canWork) {
        options.push({ kind: "retake", label: "Retake", hint: "Resume development before verification", icon: <RotateCcw /> });
      }
    }
    if (can("access.request.approve") && isAccess && status === "PENDING_APPROVAL"
        && ticket.reported_by?.id !== user?.id
        && ticket.reported_by_email?.toLowerCase() !== user?.email?.toLowerCase()) {
      options.push({ kind: "approve", label: "Approve request", hint: "Allow this access request", icon: <ShieldCheck /> });
    }
    if (can("access.request.reject") && isAccess
        && ["PENDING_APPROVAL", "NEEDS_REVIEW"].includes(status)) {
      options.push({ kind: "reject", label: "Reject request", hint: "Decline this access request", icon: <XCircle /> });
    }
    return options;
  }, [ticket, canWork, can, hasRole, isOwner, user, showVerifyClose]);

  return (
    <>
      <header className="shrink-0 border-b border-[var(--border)]">
        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[12px] font-semibold text-[var(--muted-foreground)]">
                {ticket.reference}
              </span>
              <TypePill type={ticket.ticket_type} />
              <StatusPill status={ticket.effective_status || ticket.status} />
              {isOwner && hasRole("DEVELOPER") && (ticket.effective_status || ticket.status) === "IN_PROGRESS" ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                  <PlayCircle className="size-3" /> Working now
                </span>
              ) : null}
              <span className="text-[12px] font-semibold text-purple-600 dark:text-purple-300">
                Assigned : {ticket.owner?.name || "Unassigned"}
              </span>
              {ticket.needs_review ? <Pill tone="warn">Needs review</Pill> : null}
            </div>
            <Dialog.Title className="mt-2 truncate text-lg font-semibold tracking-tight">
              {ticket.title}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              From {ticket.reported_by_name || ticket.reported_by_email || "Unknown sender"}
              {" · "}{formatDateTime(ticket.mail_received_at || ticket.created_at)}
            </Dialog.Description>
          </div>
          <IconButton label="Close dialog" onClick={onClose}><X /></IconButton>
        </div>
      </header>

      <RequestConversation messages={ticket.request_messages} onAttachments={() => setTab("attachments")} />

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border)] px-5 py-3">
          {canAssign ? (
            <Button size="sm" variant="outline" onClick={() => onAction("assign")}>
              <UserRoundCheck /> Assign
            </Button>
          ) : null}
          {statusActions.length > 0 ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button size="sm" variant="outline" className="ml-auto gap-2 border-[var(--border)] bg-[var(--card)] shadow-sm">
                  <GitCommit className="size-4 text-[var(--primary)]" /> Change status <ChevronDown className="size-3.5 text-[var(--muted-foreground)]" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  /* Above the dialog: this portals to <body>, so at z-50 it
                     rendered behind the z-[60] dialog and looked like a dead
                     button. */
                  className="z-[70] w-[min(19rem,calc(100vw-2rem))] rounded-lg border border-[var(--border)]
                             bg-[var(--popover)] p-1.5 shadow-[var(--shadow-pop)]"
                >
                  <DropdownMenu.Label className="px-2.5 pb-2 pt-1.5">
                    <span className="block text-[12px] font-semibold text-[var(--foreground)]">Change status</span>
                    <span className="block text-[11px] text-[var(--muted-foreground)]">Current: {pretty(ticket.effective_status || ticket.status)}</span>
                  </DropdownMenu.Label>
                  <DropdownMenu.Separator className="mb-1 h-px bg-[var(--border)]" />
                  {statusActions.map((option) => (
                    <DropdownMenu.Item
                      key={option.kind}
                      disabled={Boolean(ticket.active_work_conflict && ["start", "retake", "return"].includes(option.kind))}
                      onSelect={() => onAction(option.kind)}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2
                                 outline-none transition-colors data-[highlighted]:bg-[var(--muted)]
                                 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--muted)] text-[var(--primary)] [&_svg]:size-4">
                        {option.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12px] font-semibold leading-4 text-[var(--foreground)]">{option.label}</span>
                        <span className="block text-[11px] leading-4 text-[var(--muted-foreground)]">{option.hint}</span>
                      </span>
                    </DropdownMenu.Item>
                  ))}
                  {ticket.active_work_conflict && statusActions.some((option) => ["start", "retake", "return"].includes(option.kind)) ? (
                    <div className="mt-1 flex gap-2 border-t border-[var(--border)] px-2.5 py-2 text-[11px] leading-4 text-amber-700 dark:text-amber-300">
                      <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                      Finish or pause {ticket.active_work_conflict.reference} first.
                    </div>
                  ) : null}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : null}
        </div>

      <Tabs.Root value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <Tabs.List className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--border)] px-5">
          {[
            ["timeline", "Activity timeline"],
            ["chat", "Chat"],
            ["attachments", "Attachments"],
          ].map(([value, label]) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className="whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-[13px]
                         font-medium text-[var(--muted-foreground)] transition-colors
                         data-[state=active]:border-[var(--primary)]
                         data-[state=active]:text-[var(--foreground)]"
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <div className="ticket-detail-tab-panel min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <Tabs.Content value="timeline" className="outline-none">
            <TimelineTab ticket={ticket} />
          </Tabs.Content>
          <Tabs.Content value="chat" className="h-full min-h-0 outline-none">
            <TicketChatTab ticket={ticket} />
          </Tabs.Content>
          <Tabs.Content value="attachments" className="outline-none">
            <AttachmentsTab ticket={ticket} />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </>
  );
}

function RequestConversation({ messages, onAttachments }: {
  messages: RequestMessage[];
  onAttachments: () => void;
}) {
  return <section className="shrink-0 border-b border-[var(--border)] px-5 py-3">
    <h3 className="mb-2 text-[13px] font-semibold">Request details</h3>
    <ol className="max-h-44 space-y-3 overflow-y-auto pr-2">
      {messages.map((item, index) => <li key={item.id} className={cn(
        "border-l-2 pl-3", index === 0 ? "border-[var(--primary)]" : "ml-4 border-[var(--border)]",
      )}>
        <div className="flex flex-wrap items-center justify-between gap-1">
          <p className="text-[12px] font-semibold">{index === 0 ? "Original request" : "Reply"}</p>
          <span className="text-[11px] text-[var(--muted-foreground)]">{formatDateTime(item.received_at)}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
          From: {item.from_name ? `${item.from_name} <${item.from_email}>` : item.from_email || "Requester"}
          {index > 0 && item.subject ? ` · ${item.subject}` : ""}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed">{item.body || "No message body."}</p>
        {item.attachment_count ? <button type="button" className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--primary)]" onClick={onAttachments}>
          <Paperclip className="size-3" /> {item.attachment_count} attachment{item.attachment_count === 1 ? "" : "s"}
        </button> : null}
      </li>)}
    </ol>
  </section>;
}

function Pill({ tone, children }: { tone: "warn" | "info" | "good" | "bad" | "neutral"; children: React.ReactNode }) {
  const tones = {
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    info: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    bad: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    neutral: "border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]",
  };
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium", tones[tone])}>
      {children}
    </span>
  );
}

function TypePill({ type }: { type: string }) {
  const tone = type === "ACCESS_REQUEST" ? "warn"
    : type === "SERVICE_REQUEST" ? "info"
      : type === "BUG" ? "bad" : "neutral";
  return <Pill tone={tone}>{pretty(type)}</Pill>;
}

function StatusPill({ status }: { status: string }) {
  const tone = ["COMPLETED", "CLOSED", "APPROVED"].includes(status) ? "good"
    : ["PENDING_APPROVAL", "NEEDS_REVIEW"].includes(status) ? "warn"
      : status === "REJECTED" ? "bad"
        : ["ASSIGNED", "IN_PROGRESS"].includes(status) ? "info" : "neutral";
  return <Pill tone={tone}>{pretty(status)}</Pill>;
}

/* ---- TAB 1: UPDATES ---- */

function UpdatesTab({
  ticket, canUpdate, onAdd,
}: { ticket: SupportTicketDetail; canUpdate: boolean; onAdd: () => void }) {
  const manual = ticket.updates.filter((update) => update.source !== "SYSTEM");

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
        <h3 className="text-[13px] font-semibold">Request details</h3>
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          {ticket.description || "No description was captured."}
        </p>
      </section>

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold">Progress notes ({manual.length})</h3>
        {canUpdate ? (
          <Button size="sm" onClick={onAdd}>
            <MessageSquarePlus /> Add update
          </Button>
        ) : null}
      </div>

      {manual.length === 0 ? (
        <EmptyState
          icon={<MessageSquarePlus className="size-8" aria-hidden />}
          title="No updates yet"
          description={
            ticket.bug_id
              ? "Notes added here are recorded on the linked bug and appear in the activity timeline."
              : "Progress notes written on this request will appear here."
          }
          action={canUpdate ? (
            <Button size="sm" onClick={onAdd}><MessageSquarePlus /> Add update</Button>
          ) : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {manual.map((update) => (
            <li
              key={update.id}
              className="rounded-lg border border-[var(--border)] border-l-2 border-l-sky-500/60
                         bg-[var(--background)] px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-medium">{update.created_by_name}</p>
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  {formatDateTime(update.created_at)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[13px] text-[var(--muted-foreground)]">
                {update.update_text}
              </p>
              {update.remarks ? (
                <p className="mt-2 rounded-md bg-[var(--muted)] px-2 py-1.5 text-[12px] text-[var(--muted-foreground)]">
                  {update.remarks}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TicketChatTab({ ticket }: { ticket: SupportTicketDetail }) {
  const queryClient = useQueryClient();
  const key = ["ticket-chat", ticket.id];
  const socketState = useTicketSocket(`/api/v1/tickets/${ticket.id}/ws/`, key);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const messages = await ticketApi.chatMessages(ticket.id);
      return mergeChatMessages(queryClient.getQueryData<TicketChatMessage[]>(key), messages);
    },
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval: socketState === "disconnected" ? 30_000 : false,
  });
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  return <TicketChat messages={data ?? []} ticketId={ticket.id} canSend={ticket.chat_state.can_send}
    reason={ticket.chat_state.reason} loading={isLoading} />;
}

/* ---- TAB 2: TIMELINE ----
   Oldest first: the tab answers "what happened to this request", so it reads
   forwards like a story. For a BUG ticket the server folds in the linked bug's
   status and assignment history, which is where that work is actually recorded. */
const EVENT_ICON: Record<TicketTimelineEvent["type"], LucideIcon> = {
  STATUS: GitCommit,
  ASSIGNMENT: UserCheck,
  UPDATE: MessageSquare,
  SYSTEM: Bot,
  TESTING: FlaskConical,
  REOPEN: RotateCcw,
  ATTACHMENT: Paperclip,
};

function TimelineTab({ ticket }: { ticket: SupportTicketDetail }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.tickets.timeline(ticket.id),
    queryFn: () => ticketApi.timeline(ticket.id),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-14" />)}
      </div>
    );
  }
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<GitCommit className="size-8" aria-hidden />}
        title="Nothing recorded yet"
        description="Assignment, progress and closure are listed here as they happen."
      />
    );
  }

  return (
    <ol className="relative space-y-4 pl-7">
      <span className="absolute bottom-2 left-[11px] top-2 w-px bg-[var(--border)]" aria-hidden />
      {data.map((event, index) => {
        const Icon = EVENT_ICON[event.type] ?? GitCommit;
        return (
          <li key={`${event.timestamp}-${index}`} className="relative">
            <span
              className="absolute -left-7 top-0.5 grid size-[23px] place-items-center rounded-full
                         border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)]"
              aria-hidden
            >
              <Icon className="size-3" />
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[13px] font-medium">{event.title || event.description}</p>
              <span className="text-[11px] text-[var(--muted-foreground)]">
                {formatDateTime(event.timestamp)}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">{personWithRole(event.actor, event.actor_role)}</p>
            {event.title && event.description ? <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">{event.description}</p> : null}
            {event.remarks ? (
              <p className="mt-1.5 rounded-md bg-[var(--muted)] px-2 py-1.5 text-[12px] text-[var(--muted-foreground)]">
                {event.remarks}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* ---- TAB 3: ATTACHMENTS ---- */

function AttachmentsTab({ ticket }: { ticket: SupportTicketDetail }) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.tickets.attachments(ticket.id),
    queryFn: () => ticketApi.emailAttachments(ticket.id),
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[13px] font-semibold">Attachments ({data?.length ?? 0})</h3>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-12" />)}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<Paperclip className="size-8" aria-hidden />}
          title="No email attachments"
          description="Files sent by the requester will appear here."
        />
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {data.map((attachment) => (
            <li key={attachment.id} className="flex items-start gap-3 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded bg-[var(--muted)]">
                {attachment.file_type.startsWith("image/")
                  ? <ImageIcon className="size-4" aria-hidden />
                  : <FileText className="size-4" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{attachment.file_name}</p>
                <p className="text-[11px] text-[var(--foreground)]">
                  {attachment.reason}
                </p>
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  {formatBytes(attachment.file_size)} · {attachment.uploaded_by_name || "Requester"} ·{" "}
                  {formatDateTime(attachment.uploaded_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <AttachmentActions attachment={attachment} elevated />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---- ACTION DIALOG ---- */

const ACTION_META: Record<DialogKind, { title: string; label: string; hint?: string }> = {
  assign: { title: "Assign request", label: "Save" },
  update: { title: "Add update", label: "Add update" },
  start: { title: "Start work", label: "Start work", hint: "Says what you are picking up." },
  retake: { title: "Retake ticket", label: "Retake", hint: "Describe what still needs correction." },
  return: { title: "Send back to developer", label: "Send back", hint: "Describe what did not pass verification." },
  pending: { title: "Move to pending", label: "Move to pending", hint: "Explain what is still needed." },
  hold: { title: "Put on hold", label: "Put on hold", hint: "Say what it is waiting on." },
  rectify: {
    title: "Send for verification",
    label: "Send to testing",
    hint: "Say what you changed, so the tester knows what to check.",
  },
  close: {
    title: "Close ticket",
    label: "Close ticket",
    hint: "The requester is emailed this closure note.",
  },
  approve: { title: "Approve request", label: "Approve" },
  reject: { title: "Reject request", label: "Reject" },
};

/* Remarks carry the story of the ticket, so the steps that change its state ask
   for one rather than accepting a silent transition. */
const REMARKS_REQUIRED: DialogKind[] = ["retake", "return", "pending", "hold", "rectify", "close", "reject"];

function TicketActionDialog({
  open, kind, ticket, onOpenChange, onStatusChanged,
}: {
  open: boolean;
  kind: DialogKind | null;
  ticket: SupportTicketDetail;
  onOpenChange: (open: boolean) => void;
  onStatusChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const users = useAssignableUsers(["DEVELOPER"]);
  const [owner, setOwner] = useState("");
  const [updateText, setUpdateText] = useState("");
  const [remarks, setRemarks] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [resolution, setResolution] = useState("");

  useEffect(() => {
    if (open) {
      setOwner(ticket.owner?.id ?? "");
      setUpdateText("");
      setRemarks("");
      setRootCause("");
      setResolution("");
    }
  }, [open, ticket]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!kind) return ticket;
      if (kind === "assign") {
        return ticketApi.assign(ticket.id, { owner, remarks });
      }
      if (kind === "update") {
        // A confirmed BUG ticket's updates live on the bug's own timeline.
        return ticket.bug_id
          ? bugApi.addUpdate(ticket.bug_id, { update_text: updateText, remarks })
          : ticketApi.addUpdate(ticket.id, { update_text: updateText, remarks });
      }
      const target = WORK_TARGET[kind];
      if (target) {
        return ticketApi.workTransition(ticket.id, {
          to_status: target,
          remarks: kind === "rectify" && ticket.bug_id ? resolution.trim() : remarks,
          ...(kind === "rectify" && ticket.bug_id ? {
            root_cause: rootCause.trim(), resolution: resolution.trim(),
          } : {}),
        });
      }
      if (kind === "approve") return ticketApi.approve(ticket.id, { remarks });
      if (kind === "reject") return ticketApi.reject(ticket.id, { remarks });
      return ticket;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tickets.detail(ticket.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tickets.timeline(ticket.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ]);
      toast.success("Ticket updated");
      if (kind && WORK_TARGET[kind] && onStatusChanged) {
        onStatusChanged();
      } else {
        onOpenChange(false);
      }
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Unable to update ticket.")),
  });

  function submit() {
    if (kind === "assign" && !owner) {
      toast.error("Choose who will work on this.");
      return;
    }
    if (kind === "update" && updateText.trim().length < 3) {
      toast.error("Write a short update.");
      return;
    }
    if (kind && REMARKS_REQUIRED.includes(kind) && !(kind === "rectify" && ticket.bug_id)
        && remarks.trim().length < 3) {
      toast.error(kind === "reject" ? "Give a reason." : "Add a short remark.");
      return;
    }
    if (kind === "rectify" && ticket.bug_id && (!rootCause.trim() || !resolution.trim())) {
      toast.error("Root cause and resolution are required.");
      return;
    }
    mutation.mutate();
  }

  if (!kind) return null;
  const meta = ACTION_META[kind];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={kind === "assign" && ticket.owner ? "Reassign request" : meta.title}
      description={`${ticket.reference} · ${ticket.title}`}
      size="sm"
      elevated
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>{meta.label}</Button>
        </>
      }
    >
      <div className="space-y-3.5">
        {kind === "assign" ? (
          <div className="space-y-1.5">
            <Label htmlFor="action_owner" required>Assigned to</Label>
            <Select
              id="action_owner"
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              className={owner ? undefined : "text-[var(--muted-foreground)]"}
            >
              <option value="" disabled>Select…</option>
              {(users.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </Select>
          </div>
        ) : null}

        {kind === "update" ? (
          <div className="space-y-1.5">
            <Label htmlFor="action_update" required>Update</Label>
            <Textarea
              id="action_update"
              rows={4}
              value={updateText}
              onChange={(event) => setUpdateText(event.target.value)}
              placeholder="What changed, what was checked, or what is pending?"
            />
          </div>
        ) : null}

        {kind === "rectify" && ticket.bug_id ? <>
          <div className="space-y-1.5"><Label htmlFor="action_root_cause" required>Root cause</Label>
            <Textarea id="action_root_cause" value={rootCause} onChange={(event) => setRootCause(event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="action_resolution" required>Resolution</Label>
            <Textarea id="action_resolution" value={resolution} onChange={(event) => setResolution(event.target.value)} />
            <p className="text-[11px] text-[var(--muted-foreground)]">{meta.hint}</p>
          </div>
        </> : null}

        {!(kind === "rectify" && ticket.bug_id) ? <div className="space-y-1.5">
          <Label htmlFor="action_remarks" required={REMARKS_REQUIRED.includes(kind)}>
            {kind === "reject" ? "Reason" : "Remarks"}
          </Label>
          <Textarea
            id="action_remarks"
            rows={3}
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Add context for the audit history"
          />
          {meta.hint ? (
            <p className="text-[11px] text-[var(--muted-foreground)]">{meta.hint}</p>
          ) : null}
        </div> : null}
      </div>
    </Modal>
  );
}
