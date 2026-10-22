import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { Archive, ArrowRight, Paperclip, Trash2, UserRoundCheck, X } from "lucide-react";
import { toast } from "sonner";
import { ticketApi } from "@/api/services";
import { apiErrorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { Button, IconButton, Label, Select } from "@/components/ui/primitives";
import { useAssignableUsers } from "@/hooks/useMasters";
import { useAuth } from "@/features/auth/AuthContext";
import type { SupportTicketRow } from "@/types";
import { TicketEmailDescription } from "../TicketEmailDescription";
import { EmailAttachmentList } from "../EmailAttachmentList";
import { IntakeReceived, IntakeSender, IntakeSource, IntakeType, IntakeWaiting } from "../TicketIntakeCells";
import { intakeQueueLabel } from "../ticketIntake";

export interface ReviewAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: SupportTicketRow | null;
  onNotATicket?: (ticket: SupportTicketRow) => void;
  onDelete?: (ticket: SupportTicketRow) => void;
}

export function ReviewAssignDialog({ open, onOpenChange, ticket, onNotATicket, onDelete }: ReviewAssignDialogProps) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [type, setType] = useState("");
  const [owner, setOwner] = useState("");
  const ticketId = ticket?.id;
  const ticketType = ticket?.ticket_type;
  const canAssign = can("tickets.ticket.classify");
  const users = useAssignableUsers(["DEVELOPER"]);
  useEffect(() => {
    if (open) {
      setType(ticketType === "UNKNOWN" ? "" : ticketType ?? "");
      setOwner("");
    }
  }, [open, ticketId, ticketType]);
  useEffect(() => {
    if (!open || !ticketId) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    const previousOverscroll = root.style.overscrollBehavior;
    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    return () => {
      root.style.overflow = previousOverflow;
      root.style.overscrollBehavior = previousOverscroll;
    };
  }, [open, ticketId]);
  const assign = useMutation({
    mutationFn: () => ticketApi.review(ticket!.id, { ticket_type: type, owner }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      toast.success("Ticket assigned");
      onOpenChange(false);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });
  const choices = (users.data ?? []).filter((user) => !ticket?.company || user.company_id === ticket.company.id);
  return (
    <Dialog.Root open={open && Boolean(ticket)} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="focus-review-overlay" />
        <Dialog.Content className="focus-review-drawer" aria-describedby="intake-review-subject">
          <header className="focus-review-heading"><Dialog.Title>Review request</Dialog.Title>
            <Dialog.Close asChild><IconButton label="Close review panel"><X /></IconButton></Dialog.Close>
          </header>
          {ticket ? <>
            <div className="focus-review-scroll">
            <div className="focus-review-subject"><div className="focus-review-reference"><span className="font-mono">{ticket.reference}</span><div><IntakeType type={ticket.ticket_type} />{ticket.company ? <span className="focus-review-company">{ticket.company.name}</span> : null}</div></div>
              <Dialog.Description id="intake-review-subject">{ticket.title}</Dialog.Description>
              <div className="focus-review-from"><IntakeSender ticket={ticket} /><IntakeReceived ticket={ticket} full /></div>
            </div>
            <dl className="focus-review-properties"><div><dt>Source</dt><dd><IntakeSource source={ticket.source} /></dd></div><div><dt>Waiting time</dt><dd><IntakeWaiting days={ticket.age_days} /></dd></div>
              <div><dt>Company</dt><dd>{ticket.company?.name || "-"}</dd></div><div><dt>Queue</dt><dd>{intakeQueueLabel(ticket)}</dd></div></dl>
            <div className="focus-review-body"><TicketEmailDescription ticket={ticket} />
              {can("bugs.attachment.view") && (ticket.email_attachment_count ?? 0) > 0 ? <div className="focus-review-attachments">
                <div className="focus-review-files"><EmailAttachmentList ticketId={ticket.id} compact /></div>
              </div> : null}
            </div>
            <footer className="focus-review-footer">
              <div className="focus-review-section-title"><span>Review &amp; assign</span><span>Unassigned</span></div>
              {canAssign ? <form onSubmit={(event) => { event.preventDefault(); if (type && choices.some((choice) => choice.id === owner) && !assign.isPending) assign.mutate(); }}>
                <div className="focus-review-fields"><div className="space-y-1.5"><Label htmlFor="ra_type" required>Request type</Label>
                  <Select className="focus-review-select" id="ra_type" required value={type} disabled={assign.isPending} onChange={(event) => setType(event.target.value)}>
                    <option value="">Select type</option><option value="BUG">Bug</option>
                    <option value="SERVICE_REQUEST">Service Request</option><option value="ACCESS_REQUEST">Access Request</option>
                  </Select></div>
                  <div className="space-y-1.5"><Label htmlFor="ra_owner" required>Assign to developer</Label>
                    <Select className="focus-review-select" id="ra_owner" required value={owner} onChange={(event) => setOwner(event.target.value)} disabled={users.isLoading || assign.isPending}>
                      <option value="">{users.isLoading ? "Loading developers..." : "Select developer"}</option>
                      {choices.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                    </Select></div></div>
                {users.isError ? <Button type="button" variant="link" onClick={() => void users.refetch()}>Retry loading developers</Button> : null}
                <Button type="submit" disabled={!type || !choices.some((choice) => choice.id === owner) || users.isError} loading={assign.isPending}>
                  <UserRoundCheck /> Assign request <ArrowRight />
                </Button>
              </form> : null}
              <div className="focus-review-footer-meta"><span><Paperclip aria-hidden />{ticket.email_attachment_count ?? 0} {(ticket.email_attachment_count ?? 0) === 1 ? "attachment" : "attachments"}</span>
              {ticket.can_delete && can("tickets.ticket.delete") && onDelete ? <IconButton label="Delete request" disabled={assign.isPending}
                onClick={() => { onOpenChange(false); onDelete(ticket); }}><Trash2 /></IconButton> : null}
              {ticket.can_delete && can("tickets.ticket.delete") && onNotATicket ? <button type="button" className="focus-review-dismiss"
                disabled={assign.isPending} onClick={() => { onOpenChange(false); onNotATicket(ticket); }}><Archive className="size-3.5" /> Not a ticket</button> : null}
              </div>
            </footer>
            </div>
          </> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
