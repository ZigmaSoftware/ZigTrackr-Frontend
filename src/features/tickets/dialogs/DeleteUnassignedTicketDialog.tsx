import { useState } from "react";
import { Modal } from "@/components/feedback/Modal";
import { Button, Label, Textarea } from "@/components/ui/primitives";
import type { SupportTicketRow } from "@/types";

export function DeleteUnassignedTicketDialog({ ticket, pending, onClose, onDelete }: {
  ticket: SupportTicketRow;
  pending: boolean;
  onClose: () => void;
  onDelete: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const sender = ticket.reported_by_email || ticket.mail_from_email;

  return (
    <Modal open onOpenChange={(open) => { if (!open && !pending) onClose(); }}
      title="Delete unassigned ticket"
      description={`${ticket.ref_no} · ${ticket.title}`}
      footer={<>
        <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
        <Button variant="destructive" loading={pending} disabled={!reason.trim() || pending}
          onClick={() => { if (reason.trim() && !pending) onDelete(reason.trim()); }}>
          Delete{sender ? " & notify sender" : " ticket"}
        </Button>
      </>}>
      <div className="space-y-3">
        <p className="text-[13px] text-[var(--muted-foreground)]">
          This request will leave the unassigned queue. Its history will remain available for audit.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="ticket-deletion-reason" required>Reason for deletion</Label>
          <Textarea id="ticket-deletion-reason" value={reason} onChange={(event) => setReason(event.target.value)}
            required maxLength={2000} rows={4} disabled={pending}
            placeholder="Explain why this request is being removed…" aria-describedby="ticket-deletion-notice" />
        </div>
        <p id="ticket-deletion-notice" className="text-[12px] text-[var(--muted-foreground)]">
          {sender
            ? `The reason will be queued for email delivery to ${sender}. Automated/no-reply addresses and disabled mail settings may prevent notification.`
            : "No sender email is available. The reason will be recorded, but no email can be sent."}
        </p>
      </div>
    </Modal>
  );
}
