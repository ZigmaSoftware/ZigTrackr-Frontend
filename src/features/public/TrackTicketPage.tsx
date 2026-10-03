import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, GitCommit, MessageSquare, Paperclip, RotateCcw, UserCheck } from "lucide-react";
import { ticketApi } from "@/api/services";
import { apiErrorMessage, bootstrapCsrf } from "@/api/client";
import type { PublicTrackTicket, TicketChatMessage, TicketTimelineEvent } from "@/types";
import { useTicketSocket } from "@/hooks/useTicketSocket";
import { mergeChatMessages } from "@/lib/ticketChat";
import { formatDateTime } from "@/lib/dates";
import { personWithRole } from "@/lib/personRole";
import { TicketChat } from "@/components/chat/TicketChat";
import "./TrackTicketPage.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TRACK_SESSION_KEY = "zigtrackr-public-track-tab";
const TRACK_EMAIL_KEY = "zigtrackr-public-track-email";

function savedTab(): "timeline" | "chat" | null {
  try {
    const value = sessionStorage.getItem(TRACK_SESSION_KEY);
    return value === "timeline" || value === "chat" ? value : null;
  } catch {
    return null;
  }
}

function rememberTab(tab: "timeline" | "chat" | null) {
  try {
    if (tab) sessionStorage.setItem(TRACK_SESSION_KEY, tab);
    else sessionStorage.removeItem(TRACK_SESSION_KEY);
  } catch {
    // Tracking still works if browser storage is unavailable.
  }
}

function savedEmail(): string {
  try {
    return sessionStorage.getItem(TRACK_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberEmail(value: string | null) {
  try {
    if (value) sessionStorage.setItem(TRACK_EMAIL_KEY, value);
    else sessionStorage.removeItem(TRACK_EMAIL_KEY);
  } catch {
    // The verified ticket can still be viewed without browser storage.
  }
}

export function TrackTicketPage() {
  const queryClient = useQueryClient();
  const [restoreTab] = useState(savedTab);
  const [restoring, setRestoring] = useState(Boolean(restoreTab));
  const [ticketNo, setTicketNo] = useState("");
  const [email, setEmail] = useState(savedEmail);
  const [ticket, setTicket] = useState<PublicTrackTicket | null>(null);
  const [editingLookup, setEditingLookup] = useState(false);
  const [activeTab, setActiveTab] = useState<"timeline" | "chat">(restoreTab ?? "timeline");
  const [error, setError] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [showReopen, setShowReopen] = useState(false);

  useEffect(() => {
    const previous = document.title;
    document.title = "Zigma · Track your request";
    void bootstrapCsrf();
    return () => { document.title = previous; };
  }, []);

  useEffect(() => {
    if (!restoreTab) return;
    let active = true;
    void queryClient.fetchQuery({
      queryKey: ["public-track-restore"],
      queryFn: ticketApi.publicTicket,
      staleTime: 0,
      retry: false,
    }).then((data) => {
      if (!active) return;
      if (!data.found) {
        rememberTab(null);
        rememberEmail(null);
        return;
      }
      queryClient.setQueryData(["public-track-ticket", data.ticket_no], data);
      setTicketNo(data.ticket_no);
      setTicket(data);
    }).catch(() => {
      if (active) {
        rememberTab(null);
        rememberEmail(null);
      }
    }).finally(() => {
      if (active) setRestoring(false);
    });
    return () => { active = false; };
  }, [queryClient, restoreTab]);

  function selectTab(tab: "timeline" | "chat") {
    setActiveTab(tab);
    rememberTab(tab);
  }

  function editLookup() {
    if (currentTicket) setTicketNo(currentTicket.ticket_no);
    setEmail(savedEmail() || email);
    setError("");
    setEditingLookup(true);
  }

  const verify = useMutation({
    mutationFn: () => ticketApi.publicVerify({ ticket_no: ticketNo.trim().toUpperCase(), email: email.trim().toLowerCase() }),
    onSuccess: (data) => {
      for (const key of ["public-track-ticket", "public-track-activity", "public-track-chat"]) {
        queryClient.removeQueries({ queryKey: [key] });
      }
      rememberTab(data.found ? "timeline" : null);
      rememberEmail(data.found ? email.trim().toLowerCase() : null);
      if (data.found) {
        queryClient.setQueryData(["public-track-ticket", data.ticket_no], data);
        setTicketNo(data.ticket_no);
        setEmail(email.trim().toLowerCase());
      }
      setTicket(data.found ? data : null);
      setEditingLookup(false);
      setError(data.found ? "" : "No matching ticket. Check both details and try again.");
      setActiveTab("timeline");
    },
    onError: (err) => {
      rememberTab(null);
      rememberEmail(null);
      setTicket(null);
      setEditingLookup(false);
      setError(apiErrorMessage(err, "Could not check that ticket. Try again shortly."));
    },
  });
  const current = useQuery({
    queryKey: ["public-track-ticket", ticket?.ticket_no],
    queryFn: ticketApi.publicTicket,
    enabled: Boolean(ticket) && !editingLookup,
    refetchInterval: 10000,
  });
  const currentTicket = current.data ?? ticket;
  const showResult = Boolean(currentTicket) && !editingLookup;
  const activity = useQuery({
    queryKey: ["public-track-activity", ticket?.ticket_no],
    queryFn: ticketApi.publicActivity,
    enabled: Boolean(ticket) && !editingLookup,
    refetchInterval: 30000,
  });
  const socketState = useTicketSocket(ticket && !editingLookup && activeTab === "chat" ? "/api/v1/tickets/public/track/ws/" : null,
    ["public-track-chat", ticket?.ticket_no]);
  const chat = useQuery({
    queryKey: ["public-track-chat", ticket?.ticket_no],
    queryFn: async () => {
      const messages = await ticketApi.publicChat();
      return mergeChatMessages(
        queryClient.getQueryData<TicketChatMessage[]>(["public-track-chat", ticket?.ticket_no]),
        messages,
      );
    },
    enabled: Boolean(ticket) && !editingLookup && activeTab === "chat",
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval: socketState === "disconnected" ? 30_000 : false,
  });
  const reopen = useMutation({
    mutationFn: (reason: string) => ticketApi.publicReopen(reason),
    onSuccess: (data) => {
      setTicket(data);
      queryClient.setQueryData(["public-track-ticket", data.ticket_no], data);
      setShowReopen(false);
      setReopenReason("");
      setError("");
      void activity.refetch();
      void chat.refetch();
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not reopen this ticket.")),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ticketNo.trim() || !EMAIL_PATTERN.test(email.trim())) {
      setError("Enter your ticket number and the email address used for the request.");
      return;
    }
    setError("");
    verify.mutate();
  }

  return <div className={`track-page${showResult ? " has-ticket" : ""}`}><div className="track-page-inner">
    <header className="track-header">
      <div className="track-brand"><span className="track-logo">Z</span><span>zigma</span><span className="track-support">Support desk</span></div>
      <div className="track-status"><i />Here to keep you moving</div>
    </header>
    <main className="track-main">
      <div className="track-stone track-s1" aria-hidden="true" /><div className="track-stone track-s2" aria-hidden="true" /><div className="track-stone track-s3" aria-hidden="true" />
      <div className="track-hero">
        <div className="track-kicker">Support, without the guesswork</div>
        <h1>Track your request.</h1>
        <p className="track-sub">Your ticket, progress and conversation — all in one calm place.</p>
        <section className={`tracker-card${showResult ? " has-result" : ""}`} aria-label="Ticket tracking">
          <div className="track-card-head">
            <div className="track-card-heading">
              {showResult ? <button type="button" className="track-back" onClick={editLookup} aria-label="Edit ticket details" title="Edit ticket details"><ArrowLeft size={18} /></button> : null}
              <div><div className="track-card-title">{showResult ? "Your request" : "Find your ticket"}</div><div className="track-card-sub">{showResult ? "Ticket tracking" : "Secure support lookup"}</div></div>
            </div>
            <div className="track-secure"><i />Private</div>
          </div>
          {restoring ? <div className="track-restoring" role="status">Restoring your request...</div> : !showResult ? <form className="track-form" onSubmit={submit}>
            <div className="track-field"><label htmlFor="track-number">Ticket number</label><input id="track-number" autoComplete="off" maxLength={40} value={ticketNo} onChange={(event) => setTicketNo(event.target.value)} /></div>
            <div className="track-field"><label htmlFor="track-email">Your email</label><input id="track-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <button className="track-primary" type="submit" disabled={verify.isPending}>{verify.isPending ? "Finding your request..." : "Track request"}</button>
            <div className="track-helper">Both values must match your original request.</div>
            {error ? <p className="track-error" role="alert">{error}</p> : null}
          </form> : null}
          {showResult && currentTicket ? <div className="track-result">
            <div className="track-ticket-summary"><div><div className="track-ticket-number">{currentTicket.ticket_no}</div><div className="track-ticket-title">{currentTicket.subject}{currentTicket.owner_name ? ` · Assigned to ${currentTicket.owner_name}` : ""}</div></div><span className="track-badge">{currentTicket.status_label}</span></div>
            {currentTicket.can_reopen ? <div className="track-reopen">
              {!showReopen ? <>
                <p>You can re-open this ticket within 2 days of closure.</p>
                <button type="button" className="track-reopen-button" onClick={() => { setError(""); setShowReopen(true); }}><RotateCcw size={14} aria-hidden />Re-open Ticket</button>
              </> : <form onSubmit={(event) => { event.preventDefault(); if (reopenReason.trim()) reopen.mutate(reopenReason.trim()); }}>
                <label htmlFor="track-reopen-reason">Reason for re-opening</label>
                <textarea id="track-reopen-reason" required value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} />
                <div className="track-reopen-actions"><button type="button" onClick={() => setShowReopen(false)}>Cancel</button><button type="submit" disabled={reopen.isPending || !reopenReason.trim()}>Re-open Ticket</button></div>
              </form>}
            </div> : null}
            {error ? <p className="track-reopen-error" role="alert">{error}</p> : null}
            <div className="track-tabs" role="tablist" aria-label="Ticket details">
              <button type="button" role="tab" aria-selected={activeTab === "timeline"} className={`track-tab${activeTab === "timeline" ? " active" : ""}`} onClick={() => selectTab("timeline")}>Activity Timeline</button>
              <button type="button" role="tab" aria-selected={activeTab === "chat"} className={`track-tab${activeTab === "chat" ? " active" : ""}`} onClick={() => selectTab("chat")}>Chat</button>
            </div>
            {activeTab === "timeline" ? <div className="track-panel track-panel-timeline" role="tabpanel" tabIndex={0}>
              {activity.isLoading ? <p className="track-empty">Loading activity...</p> : activity.isError ? <p className="track-empty">Activity could not be loaded.</p> : <ActivityTimeline events={activity.data ?? []} />}
            </div> : <div className="track-panel track-panel-chat" role="tabpanel">
              <TicketChat messages={chat.data ?? []} publicTicketNo={currentTicket.ticket_no} canSend={currentTicket.chat_state.can_send} reason={currentTicket.chat_state.reason} loading={chat.isLoading} />
            </div>}
          </div> : null}
        </section>
      </div>
    </main>
    <footer className="track-footer"><span>Zigma Global Environ Solutions</span><span>Secure support tracking</span></footer>
  </div></div>;
}

function ActivityTimeline({ events }: { events: TicketTimelineEvent[] }) {
  if (!events.length) return <p className="track-empty">No activity yet.</p>;
  return <ol className="track-timeline">{events.map((event, index) => {
    const Icon = event.type.includes("ASSIGN") ? UserCheck
      : event.type.includes("REOPEN") ? RotateCcw
      : event.type.includes("ATTACH") ? Paperclip
      : event.type.includes("UPDATE") ? MessageSquare : GitCommit;
    return <li className="track-activity" key={`${event.timestamp}-${index}`}>
      <span className="track-activity-icon" aria-hidden="true"><Icon size={12} /></span>
      <div className="track-activity-head"><p className="track-activity-title">{event.title || event.description}</p><time className="track-activity-date" dateTime={event.timestamp}>{formatDateTime(event.timestamp)}</time></div>
      <p className="track-activity-meta">{personWithRole(event.actor, event.actor_role)}</p>
      {event.title && event.description ? <p className="track-activity-description">{event.description}</p> : null}
      {event.remarks ? <p className="track-activity-note">{event.remarks}</p> : null}
    </li>;
  })}</ol>;
}
