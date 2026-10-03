import { useQuery } from "@tanstack/react-query";
import {
  Paperclip, MessageSquare, RotateCcw, FlaskConical, GitCommit, UserCheck,
  type LucideIcon,
} from "lucide-react";
import { bugApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { Card, CardBody, CardHeader, CardTitle, Skeleton } from "@/components/ui/primitives";
import { EmptyState } from "@/components/feedback/states";
import { formatDateTime } from "@/lib/dates";
import type { TimelineEvent } from "@/types";

const EVENT_ICON: Record<TimelineEvent["type"], LucideIcon> = {
  STATUS: GitCommit,
  ASSIGNMENT: UserCheck,
  UPDATE: MessageSquare,
  TESTING: FlaskConical,
  REOPEN: RotateCcw,
  ATTACHMENT: Paperclip,
};

/* Spec 28: an immutable, chronological record of everything that happened. */
export function BugTimelineTab({ bugId }: { bugId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.bugs.timeline(bugId),
    queryFn: () => bugApi.timeline(bugId),
  });

  return (
    <Card>
      <CardHeader><CardTitle>Activity timeline</CardTitle></CardHeader>
      <CardBody>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-12" />)}
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState title="No activity recorded" />
        ) : (
          <ol className="relative space-y-4 pl-6">
            {/* The spine */}
            <span
              className="absolute bottom-2 left-[9px] top-2 w-px bg-[var(--border)]"
              aria-hidden
            />
            {data.map((event, index) => {
              const Icon = EVENT_ICON[event.type] ?? GitCommit;
              return (
                <li key={`${event.timestamp}-${index}`} className="relative">
                  <span
                    className="absolute -left-6 grid size-[18px] place-items-center rounded-full
                               border border-[var(--border)] bg-[var(--card)]"
                    aria-hidden
                  >
                    <Icon className="size-2.5 text-[var(--muted-foreground)]" />
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="text-[13px] font-medium">{event.description}</p>
                    <span className="text-[11px] text-[var(--muted-foreground)]">
                      {formatDateTime(event.timestamp)}
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--muted-foreground)]">
                    {event.actor?.name ?? "System"}
                  </p>
                  {event.remarks ? (
                    <p className="mt-1 rounded border border-[var(--border)] bg-[var(--muted)]/40 px-2 py-1 text-[12px]">
                      {event.remarks}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}
