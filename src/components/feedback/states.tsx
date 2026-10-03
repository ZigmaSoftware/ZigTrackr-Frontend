import type { ReactNode } from "react";
import { AlertCircle, Inbox, RefreshCw, ShieldAlert } from "lucide-react";
import { Button, Card, Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/* Spec 55: every page needs professional loading, empty and error states. */

export function EmptyState({
  icon, title, description, action, className,
}: {
  icon?: ReactNode; title: string; description?: string;
  action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-16 text-center", className)}>
      <div className="text-[var(--muted-foreground)]">{icon ?? <Inbox className="size-9" aria-hidden />}</div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--muted-foreground)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Unable to load data", description = "Please retry. If the problem persists, contact your administrator.",
  onRetry, className,
}: { title?: string; description?: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-16 text-center", className)}>
      <AlertCircle className="size-9 text-[var(--destructive)]" aria-hidden />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--muted-foreground)]">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw /> Retry
        </Button>
      ) : null}
    </div>
  );
}

export function PermissionDenied({ description }: { description?: string }) {
  return (
    <EmptyState
      icon={<ShieldAlert className="size-9" aria-hidden />}
      title="You do not have access to this screen"
      description={description ?? "Contact your administrator if you believe this is a mistake."}
    />
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card className="p-4">
      <Skeleton className="mb-3 h-4 w-32" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-3.5 w-full" />
        ))}
      </div>
    </Card>
  );
}

export function KpiSkeleton() {
  return (
    <Card className="p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-7 w-14" />
    </Card>
  );
}
