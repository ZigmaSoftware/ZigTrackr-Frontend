import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Image as ImageIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { bugApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { apiErrorMessage } from "@/api/client";
import { useAuth } from "@/features/auth/AuthContext";
import { Button, Card, CardBody, CardHeader, CardTitle, IconButton, Skeleton } from "@/components/ui/primitives";
import { EmptyState } from "@/components/feedback/states";
import { ConfirmDialog } from "@/components/feedback/Modal";
import { AttachmentActions } from "@/components/attachments/AttachmentActions";
import { formatBytes } from "@/lib/utils";
import { formatDateTime } from "@/lib/dates";
import type { Attachment, BugDetail } from "@/types";

export function BugAttachmentsTab({ bug }: { bug: BugDetail }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.bugs.attachments(bug.id),
    queryFn: () => bugApi.attachments(bug.id),
  });

  const upload = useMutation({
    mutationFn: (file: File) => bugApi.upload(bug.id, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bugs.attachments(bug.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bugs.timeline(bug.id) });
      toast.success("Attachment uploaded");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Upload failed.")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => bugApi.deleteAttachment(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bugs.attachments(bug.id) });
      toast.success("Attachment removed");
      setPendingDelete(null);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attachments ({data?.length ?? 0})</CardTitle>
        {bug.can_mutate && can("bugs.attachment.add") ? (
          <>
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.mutate(file);
                event.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" loading={upload.isPending}
                    onClick={() => inputRef.current?.click()}>
              <Upload /> Upload
            </Button>
          </>
        ) : null}
      </CardHeader>

      <CardBody>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-12" />)}
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={<Paperclip className="size-8" aria-hidden />}
            title="No attachments"
            description="Screenshots, logs and documents can be attached to this bug."
          />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {data.map((attachment) => {
              const isImage = attachment.file_type.startsWith("image/");
              return (
                <li key={attachment.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded bg-[var(--muted)]">
                    {isImage ? <ImageIcon className="size-4" aria-hidden />
                             : <FileText className="size-4" aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{attachment.file_name}</p>
                    <p className="text-[11px] text-[var(--muted-foreground)]">
                      {formatBytes(attachment.file_size)} · {attachment.uploaded_by?.name} ·{" "}
                      {formatDateTime(attachment.uploaded_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <AttachmentActions attachment={attachment} />
                  </div>
                  {bug.can_mutate && can("bugs.attachment.delete") ? (
                    <IconButton
                      label={`Delete ${attachment.file_name}`}
                      onClick={() => setPendingDelete(attachment)}
                    >
                      <Trash2 />
                    </IconButton>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete attachment"
        description={`"${pendingDelete?.file_name}" will be removed from this bug. The action is recorded in the audit log.`}
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
      />
    </Card>
  );
}
