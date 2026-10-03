import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/primitives";

/* ---- THE ONE TABLE ----
   Every list in the application renders through this: bugs, nine reports,
   nine masters, users, audit. Spec 3 forbids a second table implementation,
   and spec 25 wants sticky headers, compact rows, sorting and truncation
   tooltips -- built once here rather than nine times. */

export interface Column<T> {
  /** Stable key, also the sort field sent to the server. */
  key: string;
  header: string;
  /** Cell renderer. Return a ReactNode. */
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  /** Tailwind width class, e.g. "w-32". */
  width?: string;
  align?: "left" | "right" | "center";
  /** Hide below this breakpoint on narrow screens (spec 48). */
  hideBelow?: "sm" | "md" | "lg" | "xl";
  /** Excluded from the default visible set until the user enables it. */
  optional?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  isLoading?: boolean;
  /** Current sort, e.g. "-age_days". */
  ordering?: string;
  onOrderingChange?: (ordering: string) => void;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  /** Extra classes for a row, e.g. tinting overdue rows. */
  rowClassName?: (row: T) => string | undefined;
  visibleColumns?: string[];
  skeletonRows?: number;
  stickyHeader?: boolean;
}

const HIDE_BELOW: Record<string, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

const ALIGN: Record<string, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export function DataTable<T>({
  columns, rows, rowKey, isLoading, ordering, onOrderingChange, onRowClick,
  emptyTitle = "Nothing to show", emptyDescription, emptyIcon,
  rowClassName, visibleColumns, skeletonRows = 8, stickyHeader = true,
}: DataTableProps<T>) {
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const shown = visibleColumns
    ? columns.filter((c) => visibleColumns.includes(c.key))
    : columns.filter((c) => !c.optional);

  const currentField = ordering?.replace(/^-/, "");
  const isDescending = ordering?.startsWith("-");

  function toggleSort(key: string) {
    if (!onOrderingChange) return;
    if (currentField !== key) onOrderingChange(key);
    else onOrderingChange(isDescending ? key : `-${key}`);
  }

  return (
    <div className="relative w-full overflow-x-auto">
      <table className="w-full min-w-[1120px] border-collapse">
        <caption className="sr-only">{emptyTitle}</caption>
        <thead
          className={cn(
            "border-b border-[var(--border)] bg-[var(--muted)]/50",
            stickyHeader && "sticky top-0 z-10",
          )}
        >
          <tr>
            {shown.map((column) => {
              const active = currentField === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "ztable-head",
                    column.width,
                    ALIGN[column.align ?? "left"],
                    column.hideBelow && HIDE_BELOW[column.hideBelow],
                  )}
                  aria-sort={
                    active ? (isDescending ? "descending" : "ascending") : "none"
                  }
                >
                  {column.sortable && onOrderingChange ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className="inline-flex items-center gap-1 hover:text-[var(--foreground)]"
                    >
                      {column.header}
                      {active ? (
                        isDescending ? <ArrowDown className="size-3" aria-hidden />
                                     : <ArrowUp className="size-3" aria-hidden />
                      ) : (
                        <ArrowUpDown className="size-3 opacity-40" aria-hidden />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {isLoading ? (
            Array.from({ length: skeletonRows }).map((_, index) => (
              <tr key={index} className="border-b border-[var(--border)]">
                {shown.map((column) => (
                  <td key={column.key} className={cn("ztable-cell", column.hideBelow && HIDE_BELOW[column.hideBelow])}>
                    <Skeleton className="h-4 w-full max-w-[140px]" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={shown.length} className="py-14">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="text-[var(--muted-foreground)]">
                    {emptyIcon ?? <Inbox className="size-8" aria-hidden />}
                  </div>
                  <p className="text-sm font-medium">{emptyTitle}</p>
                  {emptyDescription ? (
                    <p className="max-w-sm text-[13px] text-[var(--muted-foreground)]">
                      {emptyDescription}
                    </p>
                  ) : null}
                </div>
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr
                key={rowKey(row, rowIndex)}
                onPointerDown={(event) => {
                  pointerStart.current = { x: event.clientX, y: event.clientY };
                  dragged.current = false;
                }}
                onPointerMove={(event) => {
                  const start = pointerStart.current;
                  if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) {
                    dragged.current = true;
                  }
                }}
                onPointerUp={() => { pointerStart.current = null; }}
                onClick={onRowClick ? () => {
                  // Selecting/copying text across a row must not open its detail
                  // dialog when the pointer is released.
                  if (dragged.current || window.getSelection()?.toString()) return;
                  onRowClick(row);
                } : undefined}
                className={cn(
                  "border-b border-[var(--border)] transition-colors last:border-0",
                  onRowClick && "cursor-pointer hover:bg-[var(--muted)]/60",
                  rowClassName?.(row),
                )}
              >
                {shown.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "ztable-cell",
                      ALIGN[column.align ?? "left"],
                      column.hideBelow && HIDE_BELOW[column.hideBelow],
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---- TRUNCATED CELL (spec 25) ----
   A tooltip only where the text is actually cut off. Attaching one to every
   cell in a hundred-row table costs real performance for no benefit. */
export function TruncatedCell({
  children, className, maxWidth = "max-w-[280px]",
}: { children: ReactNode; className?: string; maxWidth?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const check = () => setTruncated(element.scrollWidth > element.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children]);

  const text = typeof children === "string" ? children : undefined;

  return (
    <span
      ref={ref}
      className={cn("block truncate", maxWidth, className)}
      title={truncated && text ? text : undefined}
    >
      {children}
    </span>
  );
}
