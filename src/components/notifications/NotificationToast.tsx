import { ArrowRight } from "lucide-react";
import type { NotificationRow } from "@/types";

/* Two shapes, chosen by what the notification is.
 *
 *   T4 (chat) — avatar plus quoted text, because a message reads as a
 *   message; a one-line pill would strip the sender and the words.
 *   T2 (everything else) — a compact pill. Assignments and status moves are
 *   a single fact, and these arrive often enough that a large card each
 *   time would be an interruption rather than information.
 */

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Pulls the sender out of "New message on TKT-…" style titles. */
function senderFrom(row: NotificationRow) {
  const match = row.title.match(/from\s+(.+)$/i);
  if (match) return match[1].trim();
  return row.ticket_no ?? row.bug_no ?? "Support";
}

export function ChatToast({ row, onOpen }: {
  row: NotificationRow;
  onOpen?: () => void;
}) {
  const sender = senderFrom(row);
  return (
    <div className="zt-toast zt-toast--chat" onClick={onOpen} role="button" tabIndex={0}
         onKeyDown={(event) => { if (event.key === "Enter") onOpen?.(); }}>
      <span className="zt-toast__avatar">{initials(sender)}</span>
      <div className="zt-toast__chat-body">
        <p className="zt-toast__sender">{sender}</p>
        {row.message ? <p className="zt-toast__quote">{row.message}</p> : null}
        <p className="zt-toast__meta">
          {row.ticket_no ?? row.bug_no ?? ""}
          {row.ticket_no || row.bug_no ? " · " : ""}just now
        </p>
      </div>
    </div>
  );
}

export function PillToast({ row, onOpen }: {
  row: NotificationRow;
  onOpen?: () => void;
}) {
  return (
    <div className={`zt-toast zt-toast--pill${row.is_urgent ? " urgent" : ""}`}>
      <span className="zt-toast__dot" aria-hidden />
      <span className="zt-toast__title" title={row.title}>{row.title}</span>
      {onOpen ? (
        <button type="button" className="zt-toast__go" onClick={onOpen}
                aria-label={`Open ${row.title}`}>
          <ArrowRight className="size-[14px]" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
