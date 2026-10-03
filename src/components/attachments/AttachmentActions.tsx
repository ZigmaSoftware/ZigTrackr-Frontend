import { useEffect, useState } from "react";
import { Download, Eye, LoaderCircle } from "lucide-react";
import { api, apiErrorMessage } from "@/api/client";
import { Modal } from "@/components/feedback/Modal";
import { Button, IconButton } from "@/components/ui/primitives";

interface PreviewAttachment {
  file_name: string;
  file_type: string;
  download_url: string;
}

const PREVIEW_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf",
  "text/plain", "text/csv",
]);

export function AttachmentActions({ attachment, elevated = false }: {
  attachment: PreviewAttachment;
  elevated?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canPreview = PREVIEW_TYPES.has(attachment.file_type);

  useEffect(() => {
    if (!open || !canPreview) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    setUrl(null);
    setText(null);

    api.get<Blob>(attachment.download_url, {
      baseURL: "",
      responseType: "blob",
      signal: controller.signal,
    }).then(async ({ data }) => {
      if (controller.signal.aborted) return;
      if (data.type.split(";")[0].trim().toLowerCase() !== attachment.file_type.toLowerCase()) {
        throw new Error("The file type could not be verified for preview.");
      }
      if (attachment.file_type.startsWith("text/")) {
        const content = await data.text();
        if (!controller.signal.aborted) setText(content);
      } else {
        objectUrl = URL.createObjectURL(data);
        if (!controller.signal.aborted) setUrl(objectUrl);
      }
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error && !('isAxiosError' in reason)
          ? reason.message
          : apiErrorMessage(reason, "Could not load this attachment."));
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.download_url, attachment.file_type, canPreview, open]);

  return (
    <>
      {canPreview ? (
        <IconButton label={`Preview ${attachment.file_name}`} onClick={() => setOpen(true)}>
          <Eye />
        </IconButton>
      ) : null}
      <IconButton
        label={`Download ${attachment.file_name}`}
        onClick={() => window.open(attachment.download_url, "_blank", "noopener")}
      >
        <Download />
      </IconButton>
      {canPreview ? (
        <Modal open={open} onOpenChange={setOpen} title={attachment.file_name} size="xl" elevated={elevated}>
          {loading || (!error && !url && text === null) ? (
            <div className="flex min-h-48 items-center justify-center" role="status">
              <LoaderCircle className="size-6 animate-spin" aria-label="Loading attachment" />
            </div>
          ) : error ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-sm">
              <p role="alert">{error}</p>
              <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            </div>
          ) : url && attachment.file_type.startsWith("image/") ? (
            <img src={url} alt={attachment.file_name} className="mx-auto max-h-[75vh] max-w-full object-contain" />
          ) : url && attachment.file_type === "application/pdf" ? (
            <iframe src={url} title={attachment.file_name} className="h-[70vh] w-full border-0" />
          ) : text !== null ? (
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words text-sm">{text}</pre>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}
