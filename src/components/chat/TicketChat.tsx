import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, CheckCheck, ChevronDown, Copy, CornerUpLeft, Heart, Pencil, Pin, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ticketApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { apiErrorMessage } from "@/api/client";
import { ConfirmDialog } from "@/components/feedback/Modal";
import { mergeChatMessages } from "@/lib/ticketChat";
import { formatDateTime } from "@/lib/dates";
import { personWithRole } from "@/lib/personRole";
import type { TicketChatMessage } from "@/types";
import "./TicketChat.css";

const EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

type ChatAction = "edit" | "delete" | "react" | "star" | "pin";

function isRecipientMessage(row: TicketChatMessage, publicView: boolean) {
  return publicView ? row.sender_type === "STAFF" : row.sender_type === "REQUESTER";
}

export function TicketChat({ messages, ticketId, publicTicketNo, canSend, reason, loading }: {
  messages: TicketChatMessage[];
  ticketId?: string;
  publicTicketNo?: string;
  canSend: boolean;
  reason?: string | null;
  loading: boolean;
}) {
  const publicView = !ticketId;
  const key = publicView ? ["public-track-chat", publicTicketNo] : ["ticket-chat", ticketId];
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<TicketChatMessage | null>(null);
  const [editing, setEditing] = useState<TicketChatMessage | null>(null);
  const [editText, setEditText] = useState("");
  const [deleting, setDeleting] = useState<TicketChatMessage | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const highlightTimer = useRef<number | null>(null);
  const followLatest = useRef(true);
  const deliveredPending = useRef(new Set<string>());
  const readPending = useRef(new Set<string>());

  useEffect(() => () => {
    if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
  }, []);

  const acknowledge = useCallback((status: "delivered" | "read", messageIds: string[]) => {
    const pending = status === "read" ? readPending.current : deliveredPending.current;
    const newIds = messageIds.filter((id) => !pending.has(id));
    for (let start = 0; start < newIds.length; start += 200) {
      const batch = newIds.slice(start, start + 200);
      batch.forEach((id) => pending.add(id));
      const request = publicView ? ticketApi.publicChatReceipts(batch, status)
        : ticketApi.chatReceipts(ticketId!, batch, status);
      void request.then((updated) => {
        if (updated.length) {
          const queryKey = publicView ? ["public-track-chat", publicTicketNo] : ["ticket-chat", ticketId];
          queryClient.setQueryData<TicketChatMessage[]>(queryKey, (current) =>
            mergeChatMessages(current, updated));
          if (status === "read" && !publicView) {
            void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.sidebarCounts });
          }
        }
      }).catch(() => {
        batch.forEach((id) => pending.delete(id));
      });
    }
  }, [publicView, publicTicketNo, queryClient, ticketId]);

  const merge = (saved: TicketChatMessage) => queryClient.setQueryData<TicketChatMessage[]>(key,
    (current) => mergeChatMessages(current, saved));
  const send = useMutation({
    mutationFn: (payload: { text: string; reply?: string }) => publicView
      ? ticketApi.publicSendChat(payload.text, payload.reply)
      : ticketApi.sendChatMessage(ticketId!, payload.text, payload.reply),
    onSuccess: (saved) => {
      merge(saved);
      setDraft("");
      setReplyTo(null);
      followLatest.current = true;
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not send message.")),
  });
  const change = useMutation({
    mutationFn: (payload: { id: string; action: ChatAction; message?: string; emoji?: string }) => {
      const body = { action: payload.action, message: payload.message, emoji: payload.emoji };
      return publicView ? ticketApi.publicChatMessageAction(payload.id, body)
        : ticketApi.chatMessageAction(ticketId!, payload.id, body);
    },
    onSuccess: (saved) => {
      merge(saved);
      setEditing(null);
      setDeleting(null);
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not update message.")),
  });

  useEffect(() => {
    const list = listRef.current;
    if (list && followLatest.current) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    const list = listRef.current;
    if (loading || !list) return;
    const unread = messages.filter((row) => isRecipientMessage(row, publicView)
      && !row.is_deleted && !row.read_at);
    const scan = () => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      const area = list.getBoundingClientRect();
      const visible = unread.filter((row) => {
        const item = document.getElementById(`chat-item-${row.id}`);
        if (!item) return false;
        const rect = item.getBoundingClientRect();
        const height = Math.min(rect.bottom, area.bottom) - Math.max(rect.top, area.top);
        return height >= Math.min(40, rect.height / 2);
      }).map((row) => row.id);
      acknowledge("read", visible);
    };
    const observer = typeof IntersectionObserver === "undefined" ? null
      : new IntersectionObserver(scan, { root: list, threshold: [0, 0.5] });
    unread.forEach((row) => {
      const item = document.getElementById(`chat-item-${row.id}`);
      if (item) observer?.observe(item);
    });
    list.addEventListener("scroll", scan);
    document.addEventListener("visibilitychange", scan);
    window.addEventListener("focus", scan);
    scan();
    return () => {
      observer?.disconnect();
      list.removeEventListener("scroll", scan);
      document.removeEventListener("visibilitychange", scan);
      window.removeEventListener("focus", scan);
    };
  }, [acknowledge, loading, messages, publicView]);

  useEffect(() => {
    if (loading) return;
    const received = messages.filter((row) => isRecipientMessage(row, publicView)
      && !row.is_deleted && !row.delivered_at && !readPending.current.has(row.id));
    acknowledge("delivered", received.map((row) => row.id));
  }, [acknowledge, loading, messages, publicView]);

  const mutate = (id: string, action: ChatAction, extra?: { message?: string; emoji?: string }) =>
    change.mutate({ id, action, ...extra });

  const pinnedMessage = messages.filter((row) => row.is_pinned && !row.is_deleted).at(-1);
  const jumpToMessage = (messageId: string) => {
    const list = listRef.current;
    const item = document.getElementById(`chat-item-${messageId}`);
    if (!list || !item || !list.contains(item)) return;
    const listRect = list.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const top = list.scrollTop + itemRect.top - listRect.top - (list.clientHeight - itemRect.height) / 2;
    followLatest.current = false;
    list.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setHighlightedId(messageId);
    if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightedId(null), 2200);
  };

  return <div className={`ticket-chat${publicView ? " public" : " internal"}`}>
    {pinnedMessage ? <button type="button" className="ticket-chat-pinned" onClick={() => jumpToMessage(pinnedMessage.id)}
      title="Jump to pinned message" aria-label={`Jump to pinned message: ${pinnedMessage.message_text}`}>
      <Pin size={13} aria-hidden />
      <span>Pinned: {pinnedMessage.message_text}</span>
    </button> : null}
    <ol ref={listRef} className="ticket-chat-list" aria-label="Chat messages" aria-live="polite" tabIndex={0}
      onScroll={(event) => {
        const list = event.currentTarget;
        followLatest.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
      }}>
      {loading ? <li className="ticket-chat-empty">Loading conversation...</li> : messages.length ? messages.map((row) => {
        const ownSide = publicView ? row.sender_type === "REQUESTER" : row.sender_type !== "REQUESTER";
        const receipt = row.read_at ? "Read" : row.delivered_at ? "Delivered" : "Sent";
        return <li key={row.id} id={`chat-item-${row.id}`} className={`ticket-chat-item${ownSide ? " mine" : ""}${highlightedId === row.id ? " pinned-target" : ""}`}>
          <div className="ticket-chat-meta"><strong>{personWithRole(row.sender_display_name, row.sender_role)}</strong><span className="ticket-chat-time"><time dateTime={row.created_at}>{formatDateTime(row.created_at)}</time>
            {row.is_mine ? <span className={`ticket-chat-receipt${row.read_at ? " read" : ""}`} aria-label={receipt} title={receipt}>
              {row.delivered_at ? <CheckCheck size={15} aria-hidden /> : <Check size={15} aria-hidden />}
            </span> : null}</span></div>
          <div className="ticket-chat-bubble-line">
            <div className={`ticket-chat-bubble${row.is_deleted ? " deleted" : ""}`}>
              {row.reply_to ? <button type="button" className="ticket-chat-quote" onClick={() => {
                document.getElementById(`chat-${row.reply_to!.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
              }}><strong>{personWithRole(row.reply_to.sender_display_name, row.reply_to.sender_role)}</strong><span>{row.reply_to.is_deleted ? "Message deleted" : row.reply_to.message_text}</span></button> : null}
              {editing?.id === row.id && row.can_edit ? <form className="ticket-chat-edit" onSubmit={(event) => {
                event.preventDefault();
                if (editText.trim()) mutate(row.id, "edit", { message: editText.trim() });
              }}><input aria-label="Edit message" maxLength={4000} value={editText} onChange={(event) => setEditText(event.target.value)} autoFocus />
                <button type="button" title="Cancel edit" aria-label="Cancel edit" onClick={() => setEditing(null)}><X size={15} /></button>
                <button type="submit" title="Save edit" aria-label="Save edit" disabled={!editText.trim() || change.isPending}><Check size={15} /></button>
              </form> : <span id={`chat-${row.id}`} className="ticket-chat-text">{row.is_deleted ? "This message was deleted" : row.message_text}</span>}
              {row.edited_at && !row.is_deleted ? <span className="ticket-chat-edited">Edited</span> : null}
              {row.is_pinned && !row.is_deleted ? <Pin className="ticket-chat-marker" size={12} aria-label="Pinned" /> : null}
              {row.is_starred ? <Star className="ticket-chat-marker" size={12} fill="currentColor" aria-label="Starred" /> : null}
            </div>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger className="ticket-chat-menu-trigger" aria-label={`Actions for message from ${personWithRole(row.sender_display_name, row.sender_role)}`} title="Message actions"><ChevronDown size={17} /></DropdownMenu.Trigger>
              <DropdownMenu.Portal><DropdownMenu.Content align={ownSide ? "end" : "start"} sideOffset={5} className={`ticket-chat-menu${publicView ? "" : " internal"}`}>
                {!row.is_deleted && canSend ? <DropdownMenu.Item onSelect={() => setReplyTo(row)}><CornerUpLeft size={15} />Reply</DropdownMenu.Item> : null}
                {!row.is_deleted ? <DropdownMenu.Item onSelect={() => {
                  void navigator.clipboard.writeText(row.message_text).then(() => toast.success("Message copied.")).catch(() => toast.error("Could not copy message."));
                }}><Copy size={15} />Copy</DropdownMenu.Item> : null}
                {!row.is_deleted && canSend ? <DropdownMenu.Sub><DropdownMenu.SubTrigger><Heart size={15} />React</DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal><DropdownMenu.SubContent sideOffset={4} className={`ticket-chat-menu ticket-chat-reactions${publicView ? "" : " internal"}`}>
                    {EMOJI.map((emoji) => <DropdownMenu.Item key={emoji} aria-label={`React ${emoji}`} onSelect={() => mutate(row.id, "react", { emoji })}>{emoji}</DropdownMenu.Item>)}
                  </DropdownMenu.SubContent></DropdownMenu.Portal>
                </DropdownMenu.Sub> : null}
                <DropdownMenu.Item onSelect={() => mutate(row.id, "star")}><Star size={15} />{row.is_starred ? "Unstar" : "Star"}</DropdownMenu.Item>
                {!row.is_deleted && canSend ? <DropdownMenu.Item onSelect={() => mutate(row.id, "pin")}><Pin size={15} />{row.is_pinned ? "Unpin" : "Pin"}</DropdownMenu.Item> : null}
                {row.can_edit && canSend ? <DropdownMenu.Item onSelect={() => { setEditing(row); setEditText(row.message_text); }}><Pencil size={15} />Edit</DropdownMenu.Item> : null}
                {row.can_edit && canSend ? <DropdownMenu.Item className="danger" onSelect={() => setDeleting(row)}><Trash2 size={15} />Delete</DropdownMenu.Item> : null}
              </DropdownMenu.Content></DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
          {!row.is_deleted && row.reactions?.length ? <div className="ticket-chat-reaction-list">{row.reactions.map((reaction) => <button key={reaction.emoji} type="button" title={`${reaction.count} reaction${reaction.count === 1 ? "" : "s"}`} className={reaction.mine ? "mine" : ""} disabled={!canSend} onClick={() => mutate(row.id, "react", { emoji: reaction.emoji })}>{reaction.emoji} {reaction.count}</button>)}</div> : null}
        </li>;
      }) : <li className="ticket-chat-empty">No messages yet.</li>}
    </ol>
    {canSend ? <div className="ticket-chat-compose-wrap">
      {replyTo ? <div className="ticket-chat-reply-preview"><CornerUpLeft size={14} /><span><strong>Replying to {personWithRole(replyTo.sender_display_name, replyTo.sender_role)}</strong>{replyTo.message_text}</span><button type="button" title="Cancel reply" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><X size={16} /></button></div> : null}
      <form className="ticket-chat-compose" onSubmit={(event) => {
        event.preventDefault();
        if (draft.trim()) send.mutate({ text: draft.trim(), reply: replyTo?.id });
      }}><input aria-label="Chat message" placeholder="Write a message..." maxLength={4000} value={draft} onChange={(event) => setDraft(event.target.value)} />
        <button type="submit" disabled={send.isPending || !draft.trim()}>Send</button>
      </form>
    </div> : <div className="ticket-chat-compose-wrap">
      <p className="ticket-chat-locked">{reason || "Chat is unavailable for this ticket."}</p>
    </div>}
    <ConfirmDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }}
      title="Delete message?" description="The message will be hidden from both sides, but a deleted-message marker will remain in the conversation."
      confirmLabel="Delete" destructive elevated loading={change.isPending}
      onConfirm={() => { if (deleting) mutate(deleting.id, "delete"); }} />
  </div>;
}
