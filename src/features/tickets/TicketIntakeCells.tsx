import { Clock3, FileText, Mail, MessageCircle, UserRound } from "lucide-react";
import { formatDate, formatTime } from "@/lib/dates";
import { initials } from "@/lib/utils";
import type { SupportTicketRow } from "@/types";

const types: Record<string, string> = { UNKNOWN: "Unclassified", BUG: "Bug", SERVICE_REQUEST: "Service", ACCESS_REQUEST: "Access" };
export function IntakeType({ type }: { type: string }) {
  return <span className={`intake-type intake-type-${type.toLowerCase()}`}><i aria-hidden />{types[type] || type.replaceAll("_", " ")}</span>;
}
export function IntakeSource({ source }: { source: string }) {
  const Icon = source === "EMAIL" ? Mail : source === "WHATSAPP" ? MessageCircle : source === "JOB_CARD" ? FileText : UserRound;
  const label = ({ EMAIL: "Email", MANUAL: "Manual", JOB_CARD: "Job card", WHATSAPP: "WhatsApp", IN_PERSON: "In person" } as Record<string, string>)[source] || source.replaceAll("_", " ");
  return <span className="intake-source"><Icon aria-hidden />{label}</span>;
}
export function IntakeSender({ ticket }: { ticket: SupportTicketRow }) {
  const name = ticket.reported_by_name || ticket.reported_by?.name || ticket.reported_by_email || "Unknown sender";
  const email = ticket.reported_by_email || ticket.mail_from_email;
  return <div className="intake-sender"><span className="intake-avatar" aria-hidden>{initials(name)}</span><div><p title={name}>{name}</p><span title={email}>{email}</span></div></div>;
}
export function IntakeWaiting({ days }: { days: number }) {
  return <span className={`intake-waiting ${days >= 25 ? "intake-waiting-critical" : days >= 7 ? "intake-waiting-old" : ""}`}><Clock3 aria-hidden />{days === 0 ? "<1d" : `${days}d`} waiting</span>;
}
export function IntakeReceived({ ticket, full = false }: { ticket: SupportTicketRow; full?: boolean }) {
  const value = ticket.mail_received_at || ticket.created_at;
  const day = formatDate(value);
  return <time className="intake-date" dateTime={value}>{full ? day : day.replace(/ \d{4}$/, "")}{full ? <br /> : ", "}{formatTime(value)}{!ticket.mail_received_at ? <small>logged</small> : null}</time>;
}
