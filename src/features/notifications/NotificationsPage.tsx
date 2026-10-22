import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import { notificationApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { PageHeader } from "@/components/common/PageHeader";
import { Button, Card, Skeleton } from "@/components/ui/primitives";
import { EmptyState } from "@/components/feedback/states";
import { formatDateTime, relativeTime } from "@/lib/dates";
import type { NotificationRow } from "@/types";

const PAGE_SIZE = 25;

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const list = useQuery({
    queryKey: [...queryKeys.notifications.all, "page", page, unreadOnly],
    queryFn: () => notificationApi.list({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      ...(unreadOnly ? { unread: 1 } : {}),
    }),
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

  function open(row: NotificationRow) {
    if (!row.is_read) markRead.mutate(row.id);
    if (row.link) navigate(row.link);
  }

  const rows = list.data?.results ?? [];
  const totalPages = list.data?.total_pages ?? 1;

  return (
    <>
      <PageHeader
        title="Notifications"
        breadcrumbs={[{ label: "Notifications" }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm"
                    onClick={() => { setUnreadOnly((value) => !value); setPage(1); }}>
              {unreadOnly ? "Show all" : "Unread only"}
            </Button>
            <Button size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              <CheckCheck /> Mark all read
            </Button>
          </div>
        }
      />

      <Card>
        {list.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title={unreadOnly ? "Nothing unread" : "No notifications yet"}
            description={
              unreadOnly
                ? "You're all caught up."
                : "You'll be told here when a ticket is assigned to you or someone replies."
            }
          />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => open(row)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left
                              hover:bg-[var(--muted)] ${row.is_read ? "" : "bg-[var(--muted)]/40"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[13px] font-semibold">{row.title}</span>
                      <time className="shrink-0 text-[11px] text-[var(--muted-foreground)]"
                            dateTime={row.created_at} title={formatDateTime(row.created_at)}>
                        {relativeTime(row.created_at)}
                      </time>
                    </span>
                    {row.message ? (
                      <span className="mt-0.5 block truncate text-[12px] text-[var(--muted-foreground)]">
                        {row.message}
                      </span>
                    ) : null}
                    <span className="mt-1 block text-[11px] text-[var(--muted-foreground)]">
                      {row.type_label}
                      {row.ticket_no || row.bug_no ? ` · ${row.ticket_no ?? row.bug_no}` : ""}
                    </span>
                  </span>
                  {row.is_read ? null : (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--primary)]"
                          aria-label="Unread" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
            <span className="text-[12px] text-[var(--muted-foreground)]">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1}
                      onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages}
                      onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        ) : null}
      </Card>
    </>
  );
}
