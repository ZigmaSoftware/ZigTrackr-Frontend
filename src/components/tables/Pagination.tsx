import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button, IconButton, Select } from "@/components/ui/primitives";

export interface PaginationProps {
  page: number;
  totalPages: number;
  count: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  page, totalPages, count, pageSize, onPageChange, onPageSizeChange,
  pageSizeOptions = [25, 50, 100, 200],
}: PaginationProps) {
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-2.5">
      <p className="text-[13px] text-[var(--muted-foreground)]" aria-live="polite">
        Showing <span className="font-medium text-[var(--foreground)]">{from}–{to}</span> of{" "}
        <span className="font-medium text-[var(--foreground)]">{count}</span>
      </p>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <label htmlFor="page-size" className="text-[13px] text-[var(--muted-foreground)]">
            Rows
          </label>
          <Select
            id="page-size"
            className="h-8 w-[74px]"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <IconButton label="First page" variant="outline" disabled={page <= 1}
                      onClick={() => onPageChange(1)}>
            <ChevronsLeft />
          </IconButton>
          <IconButton label="Previous page" variant="outline" disabled={page <= 1}
                      onClick={() => onPageChange(page - 1)}>
            <ChevronLeft />
          </IconButton>
          <span className="px-2 text-[13px] tabular-nums">
            {page} / {Math.max(totalPages, 1)}
          </span>
          <IconButton label="Next page" variant="outline" disabled={page >= totalPages}
                      onClick={() => onPageChange(page + 1)}>
            <ChevronRight />
          </IconButton>
          <IconButton label="Last page" variant="outline" disabled={page >= totalPages}
                      onClick={() => onPageChange(totalPages)}>
            <ChevronsRight />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
