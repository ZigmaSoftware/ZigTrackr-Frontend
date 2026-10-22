import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Popover from "@radix-ui/react-popover";
import {
  AlertTriangle, ArrowRight, Bell, CheckCheck, FlaskConical, Inbox, MessageSquare,
  UserCheck,
} from "lucide-react";
import { notificationApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { relativeTime } from "@/lib/dates";
import type { NotificationRow } from "@/types";

/** Icon per notification type, so a row is identifiable before it is read. */
function iconFor(type: string) {
  if (type.includes("CHAT")) return MessageSquare;
  if (type.includes("ASSIGNED")) return UserCheck;
  if (type.includes("TESTING")) return FlaskConical;
  if (type.includes("OVERDUE") || type.includes("CRITICAL") || type.includes("FAILED")) {
    return AlertTriangle;
  }
  return Inbox;
}

function toneFor(type: string) {
  if (type.includes("OVERDUE") || type.includes("CRITICAL") || type.includes("FAILED")) {
    return "zt-notif-icon--danger";
  }
  if (type.includes("TESTING")) return "zt-notif-icon--testing";
  return "zt-notif-icon--default";
}


/** "Today" / "Yesterday" / a date, for the day headings in the list. */
function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function NotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");

  /* The socket pushes updates, so the interval is only a fallback for when
     it is down -- not the primary mechanism. */
  const unread = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: notificationApi.unreadCount,
    refetchInterval: 120_000,
  });
  const count = unread.data?.count ?? 0;

  const list = useQuery({
    queryKey: [...queryKeys.notifications.all, tab],
    queryFn: () => notificationApi.list(
      tab === "unread" ? { unread: 1, limit: 15 } : { limit: 15 },
    ),
    enabled: open,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount });
  }

  const markRead = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: refresh,
  });
  const markAll = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: refresh,
  });

  /* The body marks read and stays put; only the arrow navigates. Clearing a
     backlog should not bounce you through five different pages. */
  function readRow(row: NotificationRow) {
    if (!row.is_read) markRead.mutate(row.id);
  }

  function goToRow(row: NotificationRow) {
    if (!row.is_read) markRead.mutate(row.id);
    setOpen(false);
    if (row.link) navigate(row.link);
  }

  const rows = list.data?.results ?? [];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          /* The shake is bound to the unread COUNT, not to whether the panel
             has been opened -- so it stops exactly when the last item is
             read, which is what "until fully clicked" asks for. */
          className={`zt-bell${count > 0 ? " zt-bell--unread" : ""}`}
          aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
        >
          <Bell className="size-[18px]" aria-hidden />
          {count > 0 ? (
            <span className="zt-bell__badge">{count > 9 ? "9+" : count}</span>
          ) : null}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="zt-notif-panel">
          <div className="zt-notif-head">
            <span className="zt-notif-heading">
              <strong>Notifications</strong>
              {count > 0 ? <span className="zt-notif-count">{count}</span> : null}
            </span>
            {count > 0 ? (
              <button type="button" onClick={() => markAll.mutate()}
                      disabled={markAll.isPending}>
                <CheckCheck className="size-[13px]" aria-hidden /> Mark all read
              </button>
            ) : null}
          </div>

          {/* Segmented control rather than underlined tabs: it reads as a
              filter over one list, which is what it is. */}
          <div className="zt-notif-seg" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "all"}
                    className={tab === "all" ? "on" : ""}
                    onClick={() => setTab("all")}>All</button>
            <button type="button" role="tab" aria-selected={tab === "unread"}
                    className={tab === "unread" ? "on" : ""}
                    onClick={() => setTab("unread")}>
              Unread{count > 0 ? ` (${count})` : ""}
            </button>
          </div>

          <div className="zt-notif-list">
            {list.isLoading ? (
              <p className="zt-notif-empty">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="zt-notif-empty">
                {tab === "unread" ? "Nothing unread." : "No notifications yet."}
              </p>
            ) : rows.map((row, index) => {
              const Icon = iconFor(row.notification_type);
              // A date heading whenever the day changes, so a long list reads
              // as "today / yesterday / earlier" rather than one flat run.
              const heading = dayLabel(row.created_at);
              const showHeading =
                index === 0 || heading !== dayLabel(rows[index - 1].created_at);
              return (
                <div key={row.id}>
                  {showHeading ? (
                    <p className="zt-notif-day">{heading}</p>
                  ) : null}
                  <div className={`zt-notif-row${row.is_read ? "" : " unread"}`}>
                  <button
                    type="button"
                    className="zt-notif-main"
                    onClick={() => readRow(row)}
                    aria-label={row.is_read ? row.title : `${row.title} — mark as read`}
                  >
                    <span className={`zt-notif-icon ${toneFor(row.notification_type)}`}>
                      <Icon className="size-[14px]" aria-hidden />
                    </span>
                    <span className="zt-notif-body">
                      <span className="zt-notif-title">{row.title}</span>
                      {row.message ? (
                        <span className="zt-notif-text">{row.message}</span>
                      ) : null}
                      <span className="zt-notif-time">{relativeTime(row.created_at)}</span>
                    </span>
                    {row.is_read ? null : <span className="zt-notif-dot" aria-hidden />}
                  </button>
                  {row.link ? (
                    <button
                      type="button"
                      className="zt-notif-go"
                      onClick={() => goToRow(row)}
                      aria-label={`Open ${row.title}`}
                      title="Open"
                    >
                      <span><ArrowRight className="size-[15px]" aria-hidden /></span>
                    </button>
                  ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="zt-notif-foot">
            <button type="button" onClick={() => { setOpen(false); navigate("/notifications"); }}>
              View all notifications
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
