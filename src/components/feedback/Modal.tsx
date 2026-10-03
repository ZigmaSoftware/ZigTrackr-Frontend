import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "@/components/ui/primitives";

/* Radix supplies the focus trap, Escape handling and aria-modal (spec 49).
   `title` is required so no dialog can ship without an accessible name. */
export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Stack above another dialog. Radix portals every dialog to <body>, so a
   *  modal opened from inside one would otherwise render behind it. */
  elevated?: boolean;
}

const SIZES = {
  sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl",
};

export function Modal({
  open, onOpenChange, title, description, children, footer, size = "md", elevated,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={cn(
          "fixed inset-0 bg-black/45 data-[state=open]:animate-in data-[state=open]:fade-in-0",
          elevated ? "z-[80]" : "z-50",
        )} />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2",
            elevated ? "z-[80]" : "z-50",
            "rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-pop)]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col",
            SIZES[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-3.5">
            <div className="min-w-0">
              <Dialog.Title className="text-[15px] font-semibold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-[13px] text-[var(--muted-foreground)]">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <IconButton label="Close dialog"><X /></IconButton>
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto px-5 py-4">{children}</div>

          {footer ? (
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ---- CONFIRM DIALOG (spec 56) ----
   Required before reassign, resolve, close, reopen, delete. The dialog must
   state the impact, so `description` is not optional here. */
export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  elevated?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel = "Confirm",
  cancelLabel = "Cancel", destructive, loading, elevated, onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      elevated={elevated}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
    </Modal>
  );
}
