import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { RotateCcw, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { ticketApi } from "@/api/services";
import { apiErrorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { ConfirmDialog } from "@/components/feedback/Modal";
import { Button, IconButton, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import {
  useAssignableUsers, useModules, usePriorities, useProjects, useSeverities, useSubmodules,
} from "@/hooks/useMasters";
import { formatDateTime } from "@/lib/dates";
import type { SupportTicketRow } from "@/types";

const EMPTY = {
  ticketType: "",
  owner: "",
  project: "",
  module: "",
  submodule: "",
  priority: "",
  severity: "",
  expectedClosure: "",
  remarks: "",
};

type Draft = typeof EMPTY;

export interface ReviewAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: SupportTicketRow | null;
}

export function ReviewAssignDialog({ open, onOpenChange, ticket }: ReviewAssignDialogProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirmExit, setConfirmExit] = useState(false);

  /* The ticket's own classification is a starting point, not an answer: an
     UNKNOWN one has nothing to prefill, so the reviewer chooses. */
  const initial = useMemo<Draft>(() => ({
    ...EMPTY,
    ticketType: ticket && ticket.ticket_type !== "UNKNOWN" ? ticket.ticket_type : "",
    project: ticket?.project?.id ?? "",
    module: ticket?.module?.id ?? "",
    priority: ticket?.priority?.id ?? "",
    expectedClosure: ticket?.expected_closure_date ?? "",
  }), [ticket]);

  useEffect(() => {
    if (open) {
      setDraft(initial);
      setConfirmExit(false);
    }
  }, [open, initial]);

  // This dialog routes work to whoever will do it, so only developers appear.
  const users = useAssignableUsers(["DEVELOPER"]);
  const projects = useProjects();
  const modules = useModules(draft.project);
  const submodules = useSubmodules(draft.module);
  const priorities = usePriorities();
  const severities = useSeverities();

  const isBug = draft.ticketType === "BUG";
  const dirty = useMemo(
    () => (Object.keys(EMPTY) as (keyof Draft)[]).some((key) => draft[key] !== initial[key]),
    [draft, initial],
  );

  const set = useCallback(
    <K extends keyof Draft>(key: K, value: Draft[K]) =>
      setDraft((current) => ({ ...current, [key]: value })),
    [],
  );

  function close() {
    setConfirmExit(false);
    onOpenChange(false);
  }

  function requestClose() {
    if (dirty) setConfirmExit(true);
    else close();
  }

  const review = useMutation({
    mutationFn: () => ticketApi.review(ticket!.id, {
      ticket_type: draft.ticketType,
      project: draft.project || undefined,
      module: draft.module || undefined,
      submodule: draft.submodule || undefined,
      priority: draft.priority || undefined,
      severity: draft.severity || undefined,
      owner: draft.owner || undefined,
      // environment is deliberately not sent: the Bug model defaults it to
      // PRODUCTION, and the reviewer sets it later if it turns out to differ.
      expected_closure_date: draft.expectedClosure || undefined,
      remarks: draft.remarks,
    }),
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ]);
      toast.success(
        updated?.ticket_no
          ? `Assigned as ${updated.ticket_no}`
          : "Ticket reviewed",
      );
      close();
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Unable to assign ticket.")),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.ticketType) {
      toast.error("Choose a ticket type.");
      return;
    }
    if (!draft.owner) {
      toast.error("Choose who will work on this.");
      return;
    }
    if (isBug && (!draft.project || !draft.priority || !draft.severity)) {
      toast.error("A bug needs project, priority and severity.");
      return;
    }
    review.mutate();
  }

  if (!ticket) return null;

  return (
    <>
      <Dialog.Root open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
        <Dialog.Portal>
          <Dialog.Overlay
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]
                       data-[state=open]:animate-in data-[state=open]:fade-in-0"
          />
          <Dialog.Content
            onInteractOutside={(event) => {
              event.preventDefault();
              requestClose();
            }}
            className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-3xl
                       -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden
                       rounded-xl border border-[var(--border)] bg-[var(--card)]
                       shadow-[var(--shadow-pop)] max-h-[calc(100vh-3rem)]
                       data-[state=open]:animate-in data-[state=open]:fade-in-0
                       data-[state=open]:zoom-in-95"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-3.5">
              <div className="min-w-0">
                <Dialog.Title className="text-[15px] font-semibold">Review &amp; Assign</Dialog.Title>
                <Dialog.Description className="mt-0.5 truncate text-[13px] text-[var(--muted-foreground)]">
                  <span className="font-mono">{ticket.ref_no}</span> · {ticket.title}
                </Dialog.Description>
              </div>
              <IconButton label="Close dialog" onClick={requestClose}>
                <X />
              </IconButton>
            </div>

            <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
              <div className="space-y-4 overflow-y-auto px-5 py-4">
                <RequestSummary ticket={ticket} />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Ticket type" htmlFor="ra_type" required>
                    <Select
                      id="ra_type"
                      value={draft.ticketType}
                      onChange={(event) => set("ticketType", event.target.value)}
                      className={draft.ticketType ? undefined : "text-[var(--muted-foreground)]"}
                    >
                      <option value="" disabled>Select…</option>
                      <option value="BUG">Bug</option>
                      <option value="SERVICE_REQUEST">Service Request</option>
                      <option value="ACCESS_REQUEST">Access Request</option>
                    </Select>
                  </Field>
                  <Field
                    label="Assignee / Implementer"
                    htmlFor="ra_owner"
                    required
                    hint="Assigning issues the ticket number."
                  >
                    <Select
                      id="ra_owner"
                      value={draft.owner}
                      onChange={(event) => set("owner", event.target.value)}
                      className={draft.owner ? undefined : "text-[var(--muted-foreground)]"}
                    >
                      <option value="" disabled>Select…</option>
                      {(users.data ?? []).map((user) => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Project" htmlFor="ra_project" required={isBug}>
                    <Select
                      id="ra_project"
                      value={draft.project}
                      onChange={(event) => {
                        set("project", event.target.value);
                        setDraft((current) => ({ ...current, module: "", submodule: "" }));
                      }}
                    >
                      <option value="">Select…</option>
                      {(projects.data ?? []).map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Module" htmlFor="ra_module">
                    <Select
                      id="ra_module"
                      value={draft.module}
                      onChange={(event) => {
                        set("module", event.target.value);
                        setDraft((current) => ({ ...current, submodule: "" }));
                      }}
                      disabled={!draft.project}
                    >
                      <option value="">{draft.project ? "Select…" : "Choose project first"}</option>
                      {(modules.data ?? []).map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Submodule" htmlFor="ra_submodule">
                    <Select
                      id="ra_submodule"
                      value={draft.submodule}
                      onChange={(event) => set("submodule", event.target.value)}
                      disabled={!draft.module}
                    >
                      <option value="">{draft.module ? "Select…" : "Choose module first"}</option>
                      {(submodules.data ?? []).map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Priority" htmlFor="ra_priority" required={isBug}>
                    <Select
                      id="ra_priority"
                      value={draft.priority}
                      onChange={(event) => set("priority", event.target.value)}
                    >
                      <option value="">Select…</option>
                      {(priorities.data ?? []).map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Severity" htmlFor="ra_severity" required={isBug}>
                    <Select
                      id="ra_severity"
                      value={draft.severity}
                      onChange={(event) => set("severity", event.target.value)}
                      disabled={!isBug}
                    >
                      <option value="">{isBug ? "Select…" : "Bugs only"}</option>
                      {(severities.data ?? []).map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Expected closure" htmlFor="ra_expected">
                    <Input
                      id="ra_expected"
                      type="date"
                      value={draft.expectedClosure}
                      onChange={(event) => set("expectedClosure", event.target.value)}
                    />
                  </Field>
                </div>

                <Field label="Remarks" htmlFor="ra_remarks">
                  <Textarea
                    id="ra_remarks"
                    rows={3}
                    value={draft.remarks}
                    onChange={(event) => set("remarks", event.target.value)}
                    placeholder="Add context for the audit history"
                  />
                </Field>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-5 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDraft(initial)}
                  disabled={!dirty || review.isPending}
                >
                  <RotateCcw /> Reset
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={requestClose}
                    disabled={review.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" loading={review.isPending}>
                    <ShieldCheck /> Assign
                  </Button>
                </div>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        open={confirmExit}
        onOpenChange={setConfirmExit}
        title="Discard this review?"
        description="The details you entered will not be saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={close}
      />
    </>
  );
}

/* One field wrapper so every label, control and hint share the same rhythm --
   the mixed 4-column row was what made the old layout look ragged. */
function Field({
  label, htmlFor, required, hint, children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={htmlFor} required={required}>{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-[var(--muted-foreground)]">{hint}</p> : null}
    </div>
  );
}

/* The reviewer decides from the request itself, so it stays on screen rather
   than forcing a trip back to the list. */
function RequestSummary({ ticket }: { ticket: SupportTicketRow }) {
  const from = ticket.reported_by_name || ticket.reported_by?.name || "";
  const email = ticket.reported_by_email || ticket.mail_from_email || "";

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-[11px] text-[var(--muted-foreground)]">Received from</dt>
          <dd className="truncate text-[13px] font-medium">{from || email || "Unknown sender"}</dd>
          {from && email ? (
            <dd className="truncate text-[12px] text-[var(--muted-foreground)]">{email}</dd>
          ) : null}
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] text-[var(--muted-foreground)]">Source</dt>
          <dd className="text-[13px]">{ticket.source.replaceAll("_", " ").toLowerCase()}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] text-[var(--muted-foreground)]">
            {ticket.mail_received_at ? "Mailed" : "Logged"}
          </dt>
          <dd className="text-[13px]">
            {formatDateTime(ticket.mail_received_at || ticket.created_at)}
          </dd>
        </div>
      </dl>

      {ticket.description ? (
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <dt className="text-[11px] text-[var(--muted-foreground)]">Request details</dt>
          <p className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed">
            {ticket.description}
          </p>
        </div>
      ) : null}
    </section>
  );
}
