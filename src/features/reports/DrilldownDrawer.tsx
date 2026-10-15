/**
 * DrilldownDrawer — a slide-over panel that shows bug-level detail when a
 * report summary row is clicked.
 *
 * It fetches from the existing /bugs/ list API with the filter params the
 * calling report config supplies, reusing BugFilter on the backend. No new
 * endpoints are needed.
 */

import { useQuery } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { bugApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Card, CardBody, IconButton, Skeleton } from "@/components/ui/primitives";
import { ErrorState } from "@/components/feedback/states";
import { cn } from "@/lib/utils";
import { BUG_COLUMNS } from "./bugColumns";
import type { BugListRow, Paginated } from "@/types";

export type DrilldownParams = Record<string, string | string[]>;

export interface DrilldownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Query params forwarded to GET /bugs/. */
  params: DrilldownParams;
  /** Override default columns for specialised drill-downs. */
  columns?: Column<BugListRow>[];
}

export function DrilldownDrawer({
  open,
  onOpenChange,
  title,
  description,
  params,
  columns = BUG_COLUMNS,
}: DrilldownDrawerProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.reports.drilldown(title, params),
    queryFn: () => bugApi.list({ ...params, page_size: "200" }) as Promise<Paginated<BugListRow>>,
    enabled: open && Object.keys(params).length > 0,
  });

  const rows = data?.results ?? (Array.isArray(data) ? data : []) as BugListRow[];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        />
        <Dialog.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full flex-col",
            "border-l border-[var(--border)] bg-[var(--background)] shadow-[var(--shadow-pop)]",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
            "sm:max-w-3xl lg:max-w-5xl",
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-3.5">
            <div className="min-w-0">
              <Dialog.Title className="text-[15px] font-semibold">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-[13px] text-[var(--muted-foreground)]">
                  {description}
                </Dialog.Description>
              ) : null}
              <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                {isLoading
                  ? "Loading…"
                  : `${rows.length} bug${rows.length === 1 ? "" : "s"} — current status`}
              </p>
            </div>
            <Dialog.Close asChild>
              <IconButton label="Close panel"><X /></IconButton>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4">
            {isError ? (
              <Card>
                <ErrorState onRetry={() => refetch()} />
              </Card>
            ) : isLoading ? (
              <Card>
                <CardBody className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-8" />
                  ))}
                </CardBody>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <DataTable
                  columns={columns}
                  rows={rows}
                  rowKey={(row) => row.id ?? row.bug_no}
                  emptyTitle="No bugs found"
                  emptyDescription="No bugs match the current filter."
                />
              </Card>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
