import { useState } from "react";
import { Mail, Maximize2, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { SupportTicketRow } from "@/types";
import { LedgerText } from "./TicketTableCells";

export function TicketEmailDescription({ ticket, className, variant = "thread" }: { ticket: SupportTicketRow; className?: string; variant?: "thread" | "ledger" }) {
  const messages = ticket.description_messages;
  const [zoomed, setZoomed] = useState(false);
  const thread = messages?.length ? messages : [{
    id: "manual-description", kind: "ORIGINAL" as const, from_name: "Requester", from_email: "", subject: ticket.title,
    received_at: ticket.created_at, attachment_count: 0, body: ticket.description || "No description was captured.",
  }];
  return <div className={cn(variant === "ledger" ? "ledger-description" : "intake-description-scroll", className)} role="region"
    aria-label={`Description for ${ticket.reference}`} tabIndex={0} onClick={(event) => event.stopPropagation()}>
    {variant === "ledger" ? <>
      <div className="ledger-description-tools">
        <LedgerText className="ledger-description-sender" lines={1} value={thread[0].from_email || ticket.reported_by_email || thread[0].from_name || "Requester"} />
        <button type="button" className="ledger-description-zoom" title="Open full email thread" aria-label={`Open full email thread for ${ticket.reference}`} onClick={() => setZoomed(true)}><Maximize2 aria-hidden /></button>
      </div>
      <LedgerText className="ledger-description-text" value={thread[0].body || "No message body was captured."} />
    </> : thread.map((message, index) => <article className="intake-email" key={message.id}>
      <div className="intake-email-node" aria-hidden><span><Mail /></span></div>
      <header className="intake-email-header">
        <span><strong>{message.from_name || message.from_email || "Requester"}</strong><small>{index === 0 ? "Original email" : "Reply"}</small></span>
        <span className="intake-email-tools"><time dateTime={message.received_at}>{formatDateTime(message.received_at)}</time><button type="button" className="intake-email-zoom" title="Open full email thread" aria-label={`Open full email thread for ${ticket.reference}`} onClick={(event) => { event.stopPropagation(); setZoomed(true); }}><Maximize2 aria-hidden /></button></span>
      </header>
      <p className="intake-email-body">{message.body || "No message body was captured."}</p>
    </article>)}
    <Dialog.Root open={zoomed} onOpenChange={setZoomed}><Dialog.Portal>
      <Dialog.Overlay className="intake-email-zoom-overlay" />
      <Dialog.Content className="intake-email-zoom-dialog" aria-describedby={`email-thread-${ticket.reference}`}>
        <header className="intake-email-zoom-header"><div><Dialog.Title>Email thread</Dialog.Title><Dialog.Description id={`email-thread-${ticket.reference}`}>{ticket.reference} · {ticket.title}</Dialog.Description></div><Dialog.Close asChild><button type="button" className="intake-email-zoom-close" aria-label="Close email thread"><X aria-hidden /></button></Dialog.Close></header>
        <div className="intake-email-zoom-body">{thread.map((message, index) => <article className="intake-email" key={`zoom-${message.id}`}>
          <div className="intake-email-node" aria-hidden><span><Mail /></span></div>
          <header className="intake-email-header"><span><strong>{message.from_name || message.from_email || "Requester"}</strong><small>{index === 0 ? "Original email" : "Reply"}</small></span><time dateTime={message.received_at}>{formatDateTime(message.received_at)}</time></header>
          <p className="intake-email-body">{message.body || "No message body was captured."}</p>
        </article>)}</div>
      </Dialog.Content>
    </Dialog.Portal></Dialog.Root>
  </div>;
}
