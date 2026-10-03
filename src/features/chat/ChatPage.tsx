import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, MessageCircle, PanelRight, Search, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { ticketApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { TicketChat } from "@/components/chat/TicketChat";
import { useTicketSocket } from "@/hooks/useTicketSocket";
import { mergeChatMessages } from "@/lib/ticketChat";
import { formatDate, formatTime } from "@/lib/dates";
import { personWithRole } from "@/lib/personRole";
import { initials } from "@/lib/utils";
import type { SupportTicketDetail, TicketChatInboxRow, TicketChatMessage } from "@/types";
import "./ChatPage.css";

type InboxFilter = "all" | "mine" | "unread" | "closed";
const FILTERS: { value: InboxFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mine", label: "Mine" },
  { value: "unread", label: "Unread" },
  { value: "closed", label: "Closed" },
];

function toInboxRow(ticket: SupportTicketDetail): TicketChatInboxRow {
  return {
    id: ticket.id,
    reference: ticket.reference,
    title: ticket.title,
    ticket_type: ticket.ticket_type,
    status: ticket.effective_status,
    status_label: ticket.status_label,
    requester_name: ticket.reported_by_name || ticket.reported_by?.name || ticket.reported_by_email,
    requester_email: ticket.reported_by_email,
    owner_id: ticket.owner?.id ?? "",
    owner_name: ticket.owner?.name ?? "Unassigned",
    last_message_at: null,
    last_message_text: null,
    last_message_sender_type: null,
    last_message_sender_name: null,
    last_message_sender_role: "",
    last_message_is_mine: false,
    unread_count: 0,
    chat_state: ticket.chat_state,
  };
}

function lastActivityTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toDateString() === new Date().toDateString() ? formatTime(value) : formatDate(value);
}

function statusTone(status: string) {
  if (["CLOSED", "REJECTED"].includes(status)) return "closed";
  if (["ON_HOLD", "PENDING"].includes(status)) return "hold";
  return "active";
}

function avatarTone(type: string) {
  if (type === "SERVICE_REQUEST") return "service";
  if (type === "ACCESS_REQUEST") return "access";
  return "bug";
}

function ChatThread({ ticket, onBack, detailsOpen, onToggleDetails }: {
  ticket: TicketChatInboxRow;
  onBack: () => void;
  detailsOpen: boolean;
  onToggleDetails: () => void;
}) {
  const queryClient = useQueryClient();
  const key = ["ticket-chat", ticket.id];
  const socketState = useTicketSocket(`/api/v1/tickets/${ticket.id}/ws/`, key);
  const chat = useQuery({
    queryKey: key,
    queryFn: async () => mergeChatMessages(
      queryClient.getQueryData<TicketChatMessage[]>(key),
      await ticketApi.chatMessages(ticket.id),
    ),
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval: socketState === "disconnected" ? 30_000 : false,
  });
  useEffect(() => {
    if (chat.data) {
      void queryClient.invalidateQueries({ queryKey: ["tickets", "chat-inbox"] });
    }
  }, [chat.data, queryClient]);

  return <section className="chat-page-thread" aria-label={`Conversation for ${ticket.reference}`}>
    <header className="chat-page-thread-header">
      <button type="button" className="chat-page-icon-button chat-page-back" aria-label="Back to conversations" title="Back to conversations" onClick={onBack}><ArrowLeft size={18} /></button>
      <span className={`chat-page-avatar ${avatarTone(ticket.ticket_type)}`}>{initials(ticket.requester_name || "?")}</span>
      <div className="chat-page-thread-title">
        <h2>{ticket.title}</h2>
        <p><strong>{ticket.reference}</strong><span>·</span>{ticket.requester_name}<span>·</span>{ticket.status_label}</p>
      </div>
      <div className="chat-page-thread-actions">
        <Link className="chat-page-ticket-link" to={`/tickets?ticket=${encodeURIComponent(ticket.id)}`}>Ticket details</Link>
        <button type="button" className="chat-page-icon-button" aria-label={detailsOpen ? "Close ticket details" : "Show ticket details"} title={detailsOpen ? "Close ticket details" : "Show ticket details"} aria-expanded={detailsOpen} onClick={onToggleDetails}><PanelRight size={18} /></button>
      </div>
    </header>
    {chat.isError ? <div className="chat-page-thread-state">Could not load messages. <button type="button" onClick={() => void chat.refetch()}>Retry</button></div>
      : <div className="chat-page-thread-content"><TicketChat key={ticket.id} ticketId={ticket.id} messages={chat.data ?? []} canSend={ticket.chat_state.can_send} reason={ticket.chat_state.reason} loading={chat.isLoading} /></div>}
  </section>;
}

export function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get("ticket");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [retainedTicket, setRetainedTicket] = useState<TicketChatInboxRow | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchText.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [searchText]);

  const inbox = useInfiniteQuery({
    queryKey: queryKeys.tickets.chatInbox(filter, search),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => ticketApi.chatInbox({ page: pageParam, limit: 25, filter, search }),
    getNextPageParam: (lastPage) => lastPage.next ? lastPage.page + 1 : undefined,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
  const rows = useMemo(() => inbox.data?.pages.flatMap((page) => page.results) ?? [], [inbox.data]);
  const selectedId = requestedId || rows[0]?.id || null;
  const listedTicket = rows.find((row) => row.id === selectedId);
  useEffect(() => {
    if (listedTicket) setRetainedTicket(listedTicket);
  }, [listedTicket]);
  const selectedRow = listedTicket ?? (retainedTicket?.id === selectedId ? retainedTicket : null);
  const detail = useQuery({
    queryKey: queryKeys.tickets.detail(selectedId ?? ""),
    queryFn: () => ticketApi.detail(selectedId!),
    enabled: Boolean(selectedId && (!selectedRow || detailsOpen)),
  });
  const ticket = selectedRow ?? (detail.data ? toInboxRow(detail.data) : null);
  const inboxCount = inbox.data?.pages[0]?.count ?? 0;

  function selectTicket(id: string) {
    setSearchParams({ ticket: id });
    setDetailsOpen(false);
  }

  return <div className={`chat-page${requestedId ? " chat-page-mobile-thread" : ""}`}>
    <section className="chat-page-inbox" aria-label="Ticket conversations">
      <div className="chat-page-inbox-head">
        <div className="chat-page-inbox-heading"><div><h1>Chat</h1><p>Ticket conversations</p></div><span>{inboxCount} conversations</span></div>
        <label className="chat-page-search"><Search size={16} aria-hidden /><input type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search ticket, subject or requester" aria-label="Search conversations" />{searchText ? <button type="button" aria-label="Clear search" title="Clear search" onClick={() => setSearchText("")}><X size={15} /></button> : null}</label>
      </div>
      <div className="chat-page-filters" role="group" aria-label="Conversation filters">{FILTERS.map((item) => <button key={item.value} type="button" className={filter === item.value ? "active" : ""} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div>
      <div className="chat-page-conversations">
        {inbox.isPending ? <p className="chat-page-list-state">Loading conversations...</p> : inbox.isError ? <div className="chat-page-list-state">Could not load conversations. <button type="button" onClick={() => void inbox.refetch()}>Retry</button></div>
          : rows.length ? <>{rows.map((row) => <button key={row.id} type="button" className={`chat-page-conversation${selectedId === row.id ? " active" : ""}`} aria-current={selectedId === row.id ? "true" : undefined} onClick={() => selectTicket(row.id)}>
            <span className={`chat-page-avatar ${avatarTone(row.ticket_type)}`}>{initials(row.requester_name || "?")}</span>
            <span className="chat-page-conversation-body"><span className="chat-page-conversation-top"><strong>{row.title}</strong><time dateTime={row.last_message_at ?? undefined}>{lastActivityTime(row.last_message_at)}</time></span><span className="chat-page-conversation-ref">{row.reference} · {row.requester_name}</span><span className="chat-page-conversation-preview"><span>{row.last_message_text ? `${row.last_message_sender_type === "STAFF" ? `${row.last_message_is_mine ? "You" : personWithRole(row.last_message_sender_name || "Staff", row.last_message_sender_role)}: ` : ""}${row.last_message_text}` : "No messages yet"}</span>{row.unread_count > 0 ? <b className="chat-page-unread">{row.unread_count}</b> : null}</span><span className="chat-page-conversation-foot"><i className={`chat-page-status-dot ${statusTone(row.status)}`} />{row.status_label} · {row.ticket_type.replaceAll("_", " ").toLowerCase()}</span></span>
          </button>)}{inbox.hasNextPage ? <button type="button" className="chat-page-load-more" disabled={inbox.isFetchingNextPage} onClick={() => void inbox.fetchNextPage()}>{inbox.isFetchingNextPage ? "Loading..." : "Load more conversations"}</button> : null}</> : <div className="chat-page-list-state"><MessageCircle size={24} aria-hidden /><p>No matching conversations.</p></div>}
      </div>
    </section>
    {ticket ? <ChatThread key={ticket.id} ticket={ticket} onBack={() => { setSearchParams({}); setDetailsOpen(false); }} detailsOpen={detailsOpen} onToggleDetails={() => setDetailsOpen((open) => !open)} />
      : <div className="chat-page-empty-thread"><MessageCircle size={28} aria-hidden /><p>{requestedId && detail.isError ? "This ticket is unavailable." : "Select a conversation."}</p></div>}
    {detailsOpen && ticket ? <aside className="chat-page-details" aria-label="Ticket details"><div className="chat-page-details-head"><h2>Ticket details</h2><button type="button" className="chat-page-icon-button" aria-label="Close ticket details" onClick={() => setDetailsOpen(false)}><X size={18} /></button></div><div className="chat-page-details-body"><span className={`chat-page-avatar large ${avatarTone(ticket.ticket_type)}`}>{initials(ticket.requester_name || "?")}</span><h3>{ticket.title}</h3><p>{ticket.reference}</p><dl><div><dt>Requester</dt><dd>{ticket.requester_name}</dd></div><div><dt>Email</dt><dd>{ticket.requester_email || "—"}</dd></div><div><dt>Type</dt><dd>{ticket.ticket_type.replaceAll("_", " ")}</dd></div><div><dt>Status</dt><dd>{ticket.status_label}</dd></div><div><dt>Assigned to</dt><dd>{ticket.owner_name}</dd></div>{detail.data?.priority ? <div><dt>Priority</dt><dd>{detail.data.priority.name}</dd></div> : null}{detail.data?.expected_closure_date ? <div><dt>Expected closure</dt><dd>{formatDate(detail.data.expected_closure_date)}</dd></div> : null}</dl><Link className="chat-page-view-ticket" to={`/tickets?ticket=${encodeURIComponent(ticket.id)}`}>Open ticket <ChevronRight size={15} /></Link></div></aside> : null}
  </div>;
}
