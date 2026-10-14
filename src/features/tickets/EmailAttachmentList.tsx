import { useQuery } from "@tanstack/react-query";
import { FileText, Image as ImageIcon, Paperclip } from "lucide-react";
import { ticketApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { AttachmentActions } from "@/components/attachments/AttachmentActions";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { Skeleton } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/dates";
import { formatBytes } from "@/lib/utils";

/** Shared requester-only file list for the ticket tab and unassigned queue. */
export function EmailAttachmentList({ ticketId }: { ticketId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.tickets.attachments(ticketId),
    queryFn: () => ticketApi.emailAttachments(ticketId),
  });

  return (
    <div className="space-y-4">
      <h3 className="text-[13px] font-semibold">Attachments ({data?.length ?? 0})</h3>
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((index) => <Skeleton key={index} className="h-12" />)}
        </div>
      ) : isError ? (
        <ErrorState title="Unable to load email attachments" onRetry={() => void refetch()} />
      ) : !data?.length ? (
        <EmptyState icon={<Paperclip className="size-8" aria-hidden />} title="No email attachments"
          description="Files sent by the requester will appear here." />
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {data.map((attachment) => (
            <li key={attachment.id} className="flex items-start gap-3 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded bg-[var(--muted)]">
                {attachment.file_type.startsWith("image/")
                  ? <ImageIcon className="size-4" aria-hidden /> : <FileText className="size-4" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-[13px] font-medium">{attachment.file_name}</p>
                <p className="text-[11px] text-[var(--foreground)]">{attachment.reason}</p>
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  {formatBytes(attachment.file_size)} · {attachment.uploaded_by_name || "Requester"} ·{" "}
                  {formatDateTime(attachment.uploaded_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <AttachmentActions attachment={attachment} elevated />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
