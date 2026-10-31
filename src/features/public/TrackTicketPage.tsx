import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, CheckCheck, Circle, Mail, Moon, RotateCcw, ShieldCheck, Star, Sun, X } from "lucide-react";
import { ticketApi } from "@/api/services";
import { apiErrorMessage, bootstrapCsrf } from "@/api/client";
import type { PublicTrackListRow, PublicTrackStep, TicketChatMessage } from "@/types";
import { useTicketSocket } from "@/hooks/useTicketSocket";
import { mergeChatMessages } from "@/lib/ticketChat";
import { formatDateTime } from "@/lib/dates";
import { TicketChat } from "@/components/chat/TicketChat";
import { SignalPathsBackground } from "./SignalPathsBackground";
import "./TrackTicketPage.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TRACK_SESSION_KEY = "zigtrackr-public-track-tab";
const TRACK_EMAIL_KEY = "zigtrackr-public-track-email";
const TRACK_THEME_KEY = "zigtrackr-public-track-theme";

function savedTheme(): "light" | "dark" {
  try {
    const value = localStorage.getItem(TRACK_THEME_KEY);
    if (value === "light" || value === "dark") return value;
  } catch { /* Theme selection also works without storage. */ }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
// Long enough to discourage mail flooding, short enough that a genuinely
// undelivered code is not a dead end.
const RESEND_SECONDS = 60;

function savedTab(): "timeline" | "chat" | "review" | null {
  try {
    const value = sessionStorage.getItem(TRACK_SESSION_KEY);
    return value === "timeline" || value === "chat" || value === "review" ? value : null;
  } catch {
    return null;
  }
}

function rememberTab(tab: "timeline" | "chat" | "review" | null) {
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
    // The signed-in session still works without browser storage.
  }
}

/* Sign-in is by email + passcode. One verification covers every ticket that
   address owns, so the page runs in stages: ask for the address, take the
   code, list the tickets, then open one for its timeline and chat.

   The verified address lives in an httponly cookie the server sets. The
   sessionStorage keys above are only UI hints (which tab was open, which
   address to prefill) and are never the credential. */
export function TrackTicketPage() {
  const queryClient = useQueryClient();
  const [restoring, setRestoring] = useState(Boolean(savedEmail()));
  const [email, setEmail] = useState(savedEmail);
  const [signedIn, setSignedIn] = useState(false);
  const [tickets, setTickets] = useState<PublicTrackListRow[]>([]);
  const [openTicketNo, setOpenTicketNo] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "chat" | "review">(savedTab() ?? "timeline");
  const [error, setError] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [showReopen, setShowReopen] = useState(false);
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [confirmSignout, setConfirmSignout] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [theme, setTheme] = useState(savedTheme);

  useEffect(() => {
    const previous = document.body.dataset.trackTheme;
    document.body.dataset.trackTheme = theme;
    return () => {
      if (previous) document.body.dataset.trackTheme = previous;
      else delete document.body.dataset.trackTheme;
    };
  }, [theme]);

  useEffect(() => {
    if (!signedIn || !openTicketNo) return;
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    window.scrollTo(0, 0);
    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [signedIn, openTicketNo]);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try { localStorage.setItem(TRACK_THEME_KEY, next); } catch { /* Optional persistence. */ }
  }

  useEffect(() => {
    const previous = document.title;
    document.title = "Zigma · Track your request";
    void bootstrapCsrf();
    return () => { document.title = previous; };
  }, []);

  /* A refresh keeps the session: the cookie is still valid, so the list is
     re-fetched rather than making the requester verify again. */
  useEffect(() => {
    if (!savedEmail()) return;
    let active = true;
    void queryClient.fetchQuery({
      queryKey: ["public-track-session"],
      queryFn: ticketApi.publicTickets,
      staleTime: 0,
      retry: false,
    }).then((data) => {
      if (!active) return;
      setEmail(data.email);
      setTickets(data.tickets);
      setSignedIn(true);
    }).catch(() => {
      if (active) rememberEmail(null);
    }).finally(() => {
      if (active) setRestoring(false);
    });
    return () => { active = false; };
  }, [queryClient]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function selectTab(tab: "timeline" | "chat" | "review") {
    setActiveTab(tab);
    rememberTab(tab);
  }

  function clearTrackingSession() {
    rememberEmail(null);
    rememberTab(null);
    setSignedIn(false);
    setTickets([]);
    setOpenTicketNo(null);
    setAwaitingCode(false);
    setCode("");
    setError("");
    setConfirmSignout(false);
    setConfirmClose(false);
    setShowReopen(false);
    setReopenReason("");
    setReviewRating(0);
    setReviewComment("");
    setReviewSubmitted(false);
    for (const key of ["public-track-session", "public-track-ticket",
                       "public-track-activity", "public-track-chat"]) {
      queryClient.removeQueries({ queryKey: [key] });
    }
  }

  const signOut = useMutation({
    mutationFn: ticketApi.publicSignout,
    onSuccess: clearTrackingSession,
  });

  const requestOtp = useMutation({
    mutationFn: () => ticketApi.publicRequestOtp({ email: email.trim().toLowerCase() }),
    onSuccess: () => {
      setError("");
      setCode("");
      setAwaitingCode(true);
      setResendIn(RESEND_SECONDS);
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not send a code. Try again shortly.")),
  });

  /* The only call that opens a session; it returns the whole ticket list. */
  const verify = useMutation({
    mutationFn: () => ticketApi.publicVerifyOtp({
      email: email.trim().toLowerCase(), code: code.trim(),
    }),
    onSuccess: (data) => {
      rememberEmail(data.email);
      setEmail(data.email);
      setTickets(data.tickets);
      setSignedIn(true);
      setAwaitingCode(false);
      setCode("");
      setError("");
    },
    // Stay on the code step: the usual cause is a mistyped digit, and sending
    // them back to the start would mean waiting for a fresh code.
    onError: (err) => setError(apiErrorMessage(err, "That code is not valid. Request a new one.")),
  });

  const session = useQuery({
    queryKey: ["public-track-session"],
    queryFn: ticketApi.publicTickets,
    enabled: signedIn,
    refetchInterval: 20000,
  });
  useEffect(() => {
    if (session.data) setTickets(session.data.tickets);
  }, [session.data]);

  const detail = useQuery({
    queryKey: ["public-track-ticket", openTicketNo],
    queryFn: () => ticketApi.publicTicket(openTicketNo!),
    enabled: Boolean(openTicketNo),
    refetchInterval: 10000,
  });
  const openTicket = detail.data ?? null;

  /* The socket is bound to the open ticket. ticket_no is untrusted input --
     the server re-checks that the signed-in address owns it. */
  const socketState = useTicketSocket(
    openTicketNo
      ? `/api/v1/tickets/public/track/ws/?ticket_no=${encodeURIComponent(openTicketNo)}`
      : null,
    ["public-track-chat", openTicketNo],
    /* unread_count rides on the ticket payload and on the list rows, neither
       of which the socket touches, so both are refreshed here. Without this
       the badges only moved on their polls or a manual refresh. */
    () => {
      void queryClient.invalidateQueries({ queryKey: ["public-track-ticket"] });
      void queryClient.invalidateQueries({ queryKey: ["public-track-session"] });
    });

  const chat = useQuery({
    queryKey: ["public-track-chat", openTicketNo],
    queryFn: async () => mergeChatMessages(
      queryClient.getQueryData<TicketChatMessage[]>(["public-track-chat", openTicketNo]),
      await ticketApi.publicChat(openTicketNo!),
    ),
    enabled: Boolean(openTicketNo) && activeTab === "chat",
    staleTime: 0,
    refetchOnReconnect: false,
    refetchInterval: socketState === "disconnected" ? 30_000 : false,
  });

  const reopen = useMutation({
    mutationFn: (reason: string) => ticketApi.publicReopen(openTicketNo!, reason),
    onSuccess: (data) => {
      queryClient.setQueryData(["public-track-ticket", openTicketNo], data);
      void queryClient.invalidateQueries({ queryKey: ["public-track-session"] });
      setShowReopen(false);
      setReopenReason("");
      setActiveTab("timeline");
      rememberTab("timeline");
      setError("");
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not reopen this ticket.")),
  });

  const closeTicket = useMutation({
    mutationFn: () => ticketApi.publicClose(openTicketNo!),
    onSuccess: (data) => {
      queryClient.setQueryData(["public-track-ticket", openTicketNo], data);
      void queryClient.invalidateQueries({ queryKey: ["public-track-session"] });
      setShowReopen(false);
      setReopenReason("");
      setConfirmClose(false);
      setActiveTab("review");
      rememberTab("review");
      setError("");
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not close this ticket. Please try again.")),
  });

  const review = useMutation({
    mutationFn: (payload: { rating: number; comment: string }) => ticketApi.publicReview(openTicketNo!, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(["public-track-ticket", openTicketNo], data);
      void queryClient.invalidateQueries({ queryKey: ["public-track-session"] });
      setReviewSubmitted(true);
      setError("");
    },
    onError: (err) => setError(apiErrorMessage(err, "Could not send your review.")),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Enter the email address you used for the request.");
      return;
    }
    setError("");
    requestOtp.mutate();
  }

  function submitCode(event: FormEvent) {
    event.preventDefault();
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setError("");
    verify.mutate();
  }

  /* Zero while the Chat tab is open: the messages are being read, so a badge
     over the tab you are already looking at is noise. */
  const unreadChat = activeTab === "chat" ? 0 : (openTicket?.unread_count ?? 0);
  const totalUnread = tickets.reduce((sum, row) => sum + row.unread_count, 0);
  const isClosed = openTicket?.status === "CLOSED" || openTicket?.status === "REJECTED";
  const displayedTab = !isClosed && activeTab === "review" ? "timeline" : activeTab;

  useEffect(() => {
    if (!openTicketNo || !isClosed) return;
    setActiveTab("review");
    rememberTab("review");
  }, [openTicketNo, isClosed]);

  const cardTitle = openTicket ? "Your request" : signedIn ? "Your requests" : "Sign in";
  const cardSub = openTicket ? "Ticket tracking" : signedIn ? email : "Secure support access";

  return <div className={`track-page${signedIn ? " has-ticket" : ""}`} data-theme={theme}>
    <SignalPathsBackground dark={theme === "dark"} />
    <div className="track-page-inner">
    <header className="track-header">
      <div className="track-brand"><span className="track-logo">Z</span><span>zigma</span><span className="track-support">Support desk</span></div>
      <div className="track-header-tools">
        <div className="track-status"><ShieldCheck size={15} aria-hidden />Private support access</div>
        <button type="button" className="track-theme-toggle" onClick={toggleTheme}
          title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}>
          {theme === "light" ? <Moon size={17} aria-hidden /> : <Sun size={17} aria-hidden />}
        </button>
      </div>
    </header>
    <main className="track-main">
      <div className="track-hero">
        <div className="track-kicker">ZIGMA SUPPORT</div>
        <h1>Track your request.</h1>
        <p className="track-sub">Your requests, all in one place.</p>
        <section className={`tracker-card${signedIn ? " has-result" : ""}`} aria-label="Ticket tracking">
          <div className="track-card-head">
            <div className="track-card-heading">
              {openTicket ? <button type="button" className="track-back" onClick={() => { setOpenTicketNo(null); setError(""); }} aria-label="Back to your requests" title="Back to your requests"><ArrowLeft size={18} /></button> : null}
              <div><div className="track-card-title">{openTicket ? `Your Request - ${openTicket.ticket_no}` : cardTitle}</div><div className="track-card-sub">{openTicket ? `${openTicket.subject}${openTicket.owner_name ? ` · Assigned to ${openTicket.owner_name}` : ""}` : cardSub}</div></div>
            </div>
            {signedIn
              ? <div className="track-card-actions">
                  {openTicket ? <span className="track-badge" data-stage={openTicket.public_stage}>{openTicket.status_label}</span> : null}
                  <div className="track-signout-control">
                  {confirmSignout ? <>
                    <button type="button" className="track-signout" disabled={signOut.isPending}
                      aria-busy={signOut.isPending} onClick={() => signOut.mutate()}>Confirm</button>
                    <button type="button" className="track-signout-cancel" aria-label="Cancel sign out" title="Cancel sign out"
                      disabled={signOut.isPending} onClick={() => { setConfirmSignout(false); signOut.reset(); }}><X size={15} aria-hidden /></button>
                  </> : <button type="button" className="track-signout" onClick={() => setConfirmSignout(true)}>Sign out</button>}
                  </div>
                </div>
              : <div className="track-secure"><ShieldCheck size={14} aria-hidden />Private</div>}
          </div>
          {signOut.isError ? <p className="track-reopen-error" role="alert">{apiErrorMessage(signOut.error, "Could not sign out. Please try again.")}</p> : null}

          {restoring ? <div className="track-restoring" role="status">Restoring your session...</div> : null}

          {/* ---- step 1: the address ---- */}
          {!restoring && !signedIn && !awaitingCode ? <form className="track-form" onSubmit={submit}>
            <div className="track-field">
              <label htmlFor="track-email">Your email</label>
              <div className="track-email-input"><Mail size={18} aria-hidden />
              <input id="track-email" type="email" autoComplete="email" maxLength={254} placeholder="you@company.com"
                     autoFocus value={email}
                     onChange={(event) => setEmail(event.target.value)} /></div>
            </div>
            <button className="track-primary" type="submit" disabled={requestOtp.isPending}>
              {requestOtp.isPending ? "Sending code..." : "Send verification code"}
              <ArrowRight size={18} aria-hidden />
            </button>
            <div className="track-helper">We&apos;ll email a code to confirm it&apos;s you.</div>
            {error ? <p className="track-error" role="alert">{error}</p> : null}
          </form> : null}

          {/* ---- step 2: the code ---- */}
          {!restoring && awaitingCode && !signedIn ? <form className="track-form" onSubmit={submitCode}>
            <p className="track-otp-lead">
              If that address has any tickets, we&apos;ve emailed a 6-digit code to{" "}
              <strong>{email.trim().toLowerCase()}</strong>. It expires in 10 minutes.
            </p>
            <div className="track-field">
              <label htmlFor="track-code">Verification code</label>
              <input id="track-code" className="track-code-input" inputMode="numeric"
                     autoComplete="one-time-code" pattern="[0-9]*" maxLength={6}
                     autoFocus value={code}
                     onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ""))} />
            </div>
            <button className="track-primary" type="submit" disabled={verify.isPending || code.length !== 6}>
              {verify.isPending ? "Verifying..." : "Verify and continue"}
              <ArrowRight size={18} aria-hidden />
            </button>
            {error ? <p className="track-error" role="alert">{error}</p> : null}
            <div className="track-otp-actions">
              <button type="button" className="track-otp-link" onClick={() => {
                setAwaitingCode(false); setCode(""); setError("");
              }}>Use a different email</button>
              <button type="button" className="track-otp-link" disabled={resendIn > 0 || requestOtp.isPending}
                      onClick={() => requestOtp.mutate()}>
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            </div>
          </form> : null}

          {/* ---- step 3: the list ---- */}
          {signedIn && !openTicket ? <div className="track-result">
            {tickets.length === 0
              ? <p className="track-empty track-list-empty">No tickets yet for this address.</p>
              : <>
                <div className="track-list-head">
                  <span>{tickets.length} {tickets.length === 1 ? "request" : "requests"}</span>
                  {totalUnread > 0 ? <span className="track-list-unread">{totalUnread} unread</span> : null}
                </div>
                <ul className="track-list">
                  {tickets.map((row) => <li key={row.ticket_no}>
                    <button type="button" className={`track-list-row${row.unread_count > 0 ? " has-unread" : ""}`}
                            onClick={() => { setOpenTicketNo(row.ticket_no); setError(""); }}>
                      <span className="track-list-main">
                        <span className="track-list-top">
                          <strong>{row.ticket_no}</strong>
                          <span className="track-badge" data-stage={row.public_stage}>{row.status_label}</span>
                        </span>
                        <span className="track-list-subject">{row.subject}</span>
                        <span className="track-list-foot">
                          {row.owner_name ? `Assigned to ${row.owner_name}` : "Awaiting assignment"}
                          {row.last_message_at ? ` · ${formatDateTime(row.last_message_at)}` : ""}
                        </span>
                      </span>
                      {row.unread_count > 0
                        ? <b className="track-tab-badge" aria-label={`${row.unread_count} unread message${row.unread_count === 1 ? "" : "s"}`}>{row.unread_count > 9 ? "9+" : row.unread_count}</b>
                        : null}
                    </button>
                  </li>)}
                </ul>
              </>}
          </div> : null}

          {/* ---- step 4: one ticket ---- */}
          {signedIn && openTicket ? <div className="track-result">
            {openTicket.can_reopen ? <div className="track-reopen">
              {!showReopen ? <>
                <p>The issue is resolved. Confirm the fix or re-open the ticket{openTicket.auto_closes_at ? <> before <time dateTime={openTicket.auto_closes_at}>{formatDateTime(openTicket.auto_closes_at)}</time></> : " within 2 days"}. It closes automatically after that.</p>
                <div className="track-resolution-actions">
                  <button type="button" className="track-reopen-button" disabled={closeTicket.isPending}
                    onClick={() => { setError(""); setShowReopen(true); }}><RotateCcw size={14} aria-hidden />Re-open Ticket</button>
                  {openTicket.can_confirm_close ? confirmClose ? <div className="track-close-confirmation">
                    <span>Confirm the issue is fixed?</span>
                    <button type="button" className="track-close-cancel" disabled={closeTicket.isPending}
                      onClick={() => setConfirmClose(false)}>No</button>
                    <button type="button" className="track-confirm-close" disabled={closeTicket.isPending}
                      onClick={() => { setError(""); closeTicket.mutate(); }}><CheckCheck size={15} aria-hidden />{closeTicket.isPending ? "Closing..." : "Yes"}</button>
                  </div> : <button type="button" className="track-confirm-close" disabled={closeTicket.isPending}
                    onClick={() => { setError(""); setConfirmClose(true); }}><CheckCheck size={15} aria-hidden />Issue fixed - close the ticket</button> : null}
                </div>
              </> : <form onSubmit={(event) => { event.preventDefault(); if (reopenReason.trim()) reopen.mutate(reopenReason.trim()); }}>
                <label htmlFor="track-reopen-reason">Reason for re-opening</label>
                <textarea id="track-reopen-reason" required value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} />
                <div className="track-reopen-actions"><button type="button" onClick={() => setShowReopen(false)}>Cancel</button><button type="submit" disabled={reopen.isPending || !reopenReason.trim()}>Re-open Ticket</button></div>
              </form>}
            </div> : null}
            {error ? <p className="track-reopen-error" role="alert">{error}</p> : null}
            <div className="track-tabs" role="tablist" aria-label="Ticket details">
              <button id="track-timeline-tab" type="button" role="tab" aria-controls="track-timeline-panel" aria-selected={displayedTab === "timeline"} className={`track-tab${displayedTab === "timeline" ? " active" : ""}`} onClick={() => selectTab("timeline")}>Activity Timeline</button>
              <button id="track-chat-tab" type="button" role="tab" aria-controls="track-chat-panel" aria-selected={displayedTab === "chat"} className={`track-tab${displayedTab === "chat" ? " active" : ""}${unreadChat > 0 ? " has-unread" : ""}`} onClick={() => selectTab("chat")}>Chat{unreadChat > 0 ? <b className="track-tab-badge" aria-label={`${unreadChat} unread message${unreadChat === 1 ? "" : "s"}`}>{unreadChat > 9 ? "9+" : unreadChat}</b> : null}</button>
              {isClosed ? <button id="track-review-tab" type="button" role="tab" aria-controls="track-review-panel" aria-selected={displayedTab === "review"} className={`track-tab${displayedTab === "review" ? " active" : ""}`} onClick={() => selectTab("review")}>Review</button> : null}
            </div>
            {displayedTab === "timeline" ? <div id="track-timeline-panel" className="track-panel track-panel-timeline" role="tabpanel" aria-labelledby="track-timeline-tab" tabIndex={0}>
              <ActivityTimeline steps={openTicket.progress} />
            </div> : displayedTab === "chat" ? <div id="track-chat-panel" className="track-panel track-panel-chat" role="tabpanel" aria-labelledby="track-chat-tab">
              <TicketChat messages={chat.data ?? []} publicTicketNo={openTicket.ticket_no} canSend={openTicket.chat_state.can_send} reason={openTicket.chat_state.reason} loading={chat.isLoading} />
            </div> : <ReviewPanel
              rating={reviewRating}
              comment={reviewComment}
              submitted={reviewSubmitted}
              onRatingChange={setReviewRating}
              onCommentChange={setReviewComment}
              onSubmit={(event) => {
                event.preventDefault();
                if (reviewRating <= 0) return;
                if (reviewRating <= 2 && !reviewComment.trim()) {
                  setError("Please add a comment for a 1 or 2 star rating.");
                  return;
                }
                review.mutate({ rating: reviewRating, comment: reviewComment.trim() });
              }}
              submitting={review.isPending}
            />}
          </div> : null}
          <div className="track-card-note"><ShieldCheck size={13} aria-hidden /><span>Your requests are visible only to you and our team.</span></div>
        </section>
        <p className="track-under-card">Zigma Global Environ Solutions</p>
      </div>
    </main>
    <footer className="track-footer"><span>Secure support tracking</span></footer>
  </div></div>;
}

function ActivityTimeline({ steps }: { steps: PublicTrackStep[] }) {
  if (!steps?.length) return <p className="track-empty">Progress will appear shortly.</p>;
  return <ol className="track-progress" aria-label="Request progress">{steps.map((step, index) => {
    return <li className="track-progress-step" data-state={step.state} data-stage={step.code}
      aria-current={step.state === "current" ? "step" : undefined} key={`${index}-${step.code}`}>
      <span className="track-progress-icon" aria-hidden="true">{step.state === "complete" ? <Check size={13} /> : <Circle size={step.state === "current" ? 10 : 7} />}</span>
      <div className="track-progress-heading"><span>{step.label}</span><span className="track-progress-state">{step.state === "complete" ? "Completed" : step.state === "current" ? "Current" : "Upcoming"}</span></div>
      {step.completed_at ? <time className="track-progress-date" dateTime={step.completed_at}>{formatDateTime(step.completed_at)}</time> : null}
    </li>;
  })}</ol>;
}

function ReviewPanel({
  rating,
  comment,
  submitted,
  onRatingChange,
  onCommentChange,
  onSubmit,
  submitting,
}: {
  rating: number;
  comment: string;
  submitted: boolean;
  onRatingChange: (value: number) => void;
  onCommentChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
}) {
  if (submitted) {
    return <div id="track-review-panel" className="track-panel track-review-panel track-review-panel-submitted" role="tabpanel" aria-labelledby="track-review-tab">
      <div className="track-review-success">
        <span className="track-review-success-icon"><Check size={20} aria-hidden /></span>
        <p className="track-review-eyebrow">THANK YOU</p>
        <h2>Your feedback was received.</h2>
        <p>Your review helps us improve the support experience.</p>
      </div>
    </div>;
  }

  return <form id="track-review-panel" className="track-panel track-review-panel" role="tabpanel" aria-labelledby="track-review-tab" onSubmit={onSubmit}>
    <div className="track-review-card">
      <h2>How did we do?</h2>
      <p className="track-review-copy">Your issue was resolved by our support team. Tell us how the experience felt.</p>
      <div className="track-review-stars" role="radiogroup" aria-label="Rate your support experience">
        {[1, 2, 3, 4, 5].map((value) => <button
          key={value}
          type="button"
          className={value <= rating ? "selected" : ""}
          role="radio"
          aria-checked={value === rating}
          aria-label={`${value} out of 5 stars`}
          onClick={() => onRatingChange(value)}
        ><Star size={29} fill="currentColor" aria-hidden /></button>)}
      </div>
      <p className="track-review-rating-label">{rating ? `${rating} out of 5` : "Select a rating"}</p>
      <label className="track-review-comment" htmlFor="track-review-comment">Comment {rating <= 2 ? <span className="required">Required for 1-2 stars</span> : <span>(optional)</span>}</label>
      <textarea id="track-review-comment" value={comment} required={rating > 0 && rating <= 2} maxLength={2000} placeholder={rating > 0 && rating <= 2 ? "Tell us what went wrong" : "Add an optional comment"} onChange={(event) => onCommentChange(event.target.value)} />
      <button className="track-review-submit" type="submit" disabled={!rating || submitting}><span>{submitting ? "Sending..." : "Send review"}</span><ArrowRight size={16} aria-hidden /></button>
    </div>
  </form>;
}
