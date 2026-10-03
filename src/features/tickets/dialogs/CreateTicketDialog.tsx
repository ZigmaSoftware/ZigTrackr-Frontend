import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";
import { ticketApi } from "@/api/services";
import { apiErrorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { ConfirmDialog } from "@/components/feedback/Modal";
import { cn } from "@/lib/utils";
import { Button, IconButton, Input, Label, Select, Textarea } from "@/components/ui/primitives";

/* Both dropdowns start unselected rather than on a plausible default: a
   pre-filled type or source is a guess the creator never has to look at, and a
   wrong one is only caught downstream at review. */
const EMPTY = {
  ticketType: "",
  title: "",
  description: "",
  reportedBy: "",
  reportedByEmail: "",
  source: "",
};

/* Deliberately permissive: one @, a dot in the domain, no spaces. Anything
   stricter rejects addresses that are in fact deliverable, and the mail server
   is the real authority on that. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Draft = typeof EMPTY;

export interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTicketDialog({ open, onOpenChange }: CreateTicketDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirmExit, setConfirmExit] = useState(false);

  const dirty = useMemo(
    () => (Object.keys(EMPTY) as (keyof Draft)[]).some((key) => draft[key] !== EMPTY[key]),
    [draft],
  );

  const emailInvalid =
    draft.reportedByEmail.trim().length > 0 && !EMAIL_PATTERN.test(draft.reportedByEmail.trim());

  const set = useCallback(
    <K extends keyof Draft>(key: K, value: Draft[K]) =>
      setDraft((current) => ({ ...current, [key]: value })),
    [],
  );

  function close() {
    setDraft(EMPTY);
    setConfirmExit(false);
    onOpenChange(false);
  }

  /* Escape and the overlay both route here: an abandoned draft is worth one
     question, an untouched form is not. */
  function requestClose() {
    if (dirty) setConfirmExit(true);
    else close();
  }

  const create = useMutation({
    mutationFn: () =>
      ticketApi.create({
        ticket_type: draft.ticketType,
        title: draft.title.trim(),
        description: draft.description.trim(),
        source: draft.source,
        ...(draft.reportedBy.trim() ? { reported_by_name: draft.reportedBy.trim() } : {}),
        ...(draft.reportedByEmail.trim()
          ? { reported_by_email: draft.reportedByEmail.trim() }
          : {}),
      }),
    onSuccess: async (ticket) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ]);
      toast.success(
        draft.reportedByEmail.trim()
          ? `${ticket.reference} created. Sent to ${draft.reportedByEmail.trim()}.`
          : `${ticket.reference} created`,
      );
      close();
      navigate(`/tickets/detail/${ticket.id}`);
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Unable to create ticket.")),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.ticketType) {
      toast.error("Choose a ticket type.");
      return;
    }
    if (!draft.source) {
      toast.error("Choose where this request came from.");
      return;
    }
    if (draft.title.trim().length < 5) {
      toast.error("Give the ticket a clear title.");
      return;
    }
    if (draft.description.trim().length < 10) {
      toast.error("Add enough detail for review.");
      return;
    }
    if (emailInvalid) {
      toast.error("Enter a valid email address, or leave it empty.");
      return;
    }
    create.mutate();
  }

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
            className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-2xl
                       -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden
                       rounded-xl border border-[var(--border)] bg-[var(--card)]
                       shadow-[var(--shadow-pop)] max-h-[calc(100vh-3rem)]
                       data-[state=open]:animate-in data-[state=open]:fade-in-0
                       data-[state=open]:zoom-in-95"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-3.5">
              <div className="min-w-0">
                <Dialog.Title className="text-[15px] font-semibold">Create Ticket</Dialog.Title>
                <Dialog.Description className="mt-0.5 text-[13px] text-[var(--muted-foreground)]">
                  Capture the request. Routing, priority and assignment happen from Unassigned Tickets.
                </Dialog.Description>
              </div>
              <IconButton label="Close dialog" onClick={requestClose}>
                <X />
              </IconButton>
            </div>

            <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
              <div className="space-y-4 overflow-y-auto px-5 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ct_type" required>Ticket type</Label>
                    <Select
                      id="ct_type"
                      value={draft.ticketType}
                      onChange={(event) => set("ticketType", event.target.value)}
                      className={cn(!draft.ticketType && "text-[var(--muted-foreground)]")}
                    >
                      <option value="" disabled>Select…</option>
                      <option value="BUG">Bug</option>
                      <option value="SERVICE_REQUEST">Service Request</option>
                      <option value="ACCESS_REQUEST">Access Request</option>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ct_source" required>Source</Label>
                    <Select
                      id="ct_source"
                      value={draft.source}
                      onChange={(event) => set("source", event.target.value)}
                      className={cn(!draft.source && "text-[var(--muted-foreground)]")}
                    >
                      <option value="" disabled>Select…</option>
                      <option value="MANUAL">Manual</option>
                      <option value="EMAIL">Email</option>
                      <option value="WHATSAPP">WhatsApp</option>
                      <option value="IN_PERSON">In Person</option>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ct_title" required>Title / Subject</Label>
                  <Input
                    id="ct_title"
                    value={draft.title}
                    onChange={(event) => set("title", event.target.value)}
                    placeholder="Short summary of the request"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ct_description" required>Description / Request Details</Label>
                  <Textarea
                    id="ct_description"
                    rows={6}
                    value={draft.description}
                    onChange={(event) => set("description", event.target.value)}
                    placeholder="What is needed, what happened, and any useful context."
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ct_from">From</Label>
                    <Input
                      id="ct_from"
                      value={draft.reportedBy}
                      onChange={(event) => set("reportedBy", event.target.value)}
                      placeholder="Who raised this request"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ct_from_email">Their email</Label>
                    <Input
                      id="ct_from_email"
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      value={draft.reportedByEmail}
                      onChange={(event) => set("reportedByEmail", event.target.value)}
                      aria-invalid={emailInvalid}
                      aria-describedby="ct_from_email_hint"
                      placeholder="name@company.com"
                    />
                  </div>
                  <p
                    id="ct_from_email_hint"
                    className={cn(
                      "text-[12px] sm:col-span-2",
                      emailInvalid ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]",
                    )}
                  >
                    {emailInvalid
                      ? "That address is not valid. Check it, or clear the field."
                      : "Add an email to send them the ticket number. Leave both empty to record the ticket against yourself."}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-5 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDraft(EMPTY)}
                  disabled={!dirty || create.isPending}
                >
                  <RotateCcw /> Reset
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={requestClose}
                    disabled={create.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" loading={create.isPending} disabled={emailInvalid}>
                    <Save /> Create Ticket
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
        title="Discard this ticket?"
        description="The details you entered will not be saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={close}
      />
    </>
  );
}
