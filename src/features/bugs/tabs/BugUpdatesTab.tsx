import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquarePlus, Sparkles } from "lucide-react";
import { bugApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { useAuth } from "@/features/auth/AuthContext";
import { Button, Card, CardBody, CardHeader, CardTitle, Skeleton } from "@/components/ui/primitives";
import { EmptyState } from "@/components/feedback/states";
import { StatusBadge } from "@/components/common/badges";
import { AddUpdateDialog } from "@/features/bugs/dialogs/AddUpdateDialog";
import { formatDate, formatDateTime } from "@/lib/dates";
import type { BugDetail, BugUpdateRow, Paginated } from "@/types";

export function BugUpdatesTab({ bug }: { bug: BugDetail }) {
  const { can } = useAuth();
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.bugs.updates(bug.id),
    queryFn: () => bugApi.updates(bug.id),
  });

  const updates: BugUpdateRow[] = Array.isArray(data)
    ? data
    : ((data as Paginated<BugUpdateRow> | undefined)?.results ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily updates ({updates.length})</CardTitle>
        {bug.can_mutate && can("bugs.update.add") ? (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <MessageSquarePlus /> Add update
          </Button>
        ) : null}
      </CardHeader>

      <CardBody>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16" />)}
          </div>
        ) : updates.length === 0 ? (
          <EmptyState
            title="No updates yet"
            description="Daily updates are permanent — each one is added to the history and never overwritten."
          />
        ) : (
          <ol className="space-y-3">
            {updates.map((update) => (
              <li
                key={update.id}
                className="rounded-lg border border-[var(--border)] p-3"
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <StatusBadge status={update.status} label={update.status_label} />
                  <span className="text-[12px] font-medium">{update.updated_by?.name}</span>
                  <span className="text-[11px] text-[var(--muted-foreground)]">
                    {formatDateTime(update.created_at)}
                  </span>
                  {update.is_system_generated ? (
                    <span
                      className="inline-flex items-center gap-1 rounded bg-[var(--muted)] px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]"
                      title="Recorded automatically alongside a status change"
                    >
                      <Sparkles className="size-2.5" aria-hidden /> Auto
                    </span>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap text-[13px]">{update.update_text}</p>
                {update.remarks ? (
                  <p className="mt-1.5 text-[12px] text-[var(--muted-foreground)]">
                    <span className="font-medium">Remarks:</span> {update.remarks}
                  </p>
                ) : null}
                {update.next_action ? (
                  <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                    <span className="font-medium">Next:</span> {update.next_action}
                  </p>
                ) : null}
                {update.expected_completion_date ? (
                  <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                    <span className="font-medium">ETA:</span> {formatDate(update.expected_completion_date)}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </CardBody>

      <AddUpdateDialog bugId={bug.id} bugNo={bug.bug_no} open={addOpen} onOpenChange={setAddOpen} />
    </Card>
  );
}
