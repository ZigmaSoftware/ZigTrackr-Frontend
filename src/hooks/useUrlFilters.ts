import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/* ---- URL-SYNCED FILTER STATE ----
   Filters live in the querystring so a filtered view is shareable, survives a
   refresh, and works with the browser's back button. Retrofitting this onto a
   page built with useState means rewriting the page, so it is here from the
   start. */

export interface FilterState {
  page: number;
  limit: number;
  ordering: string;
  [key: string]: unknown;
}

export function useUrlFilters(defaults: Partial<FilterState> = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const result: Record<string, unknown> = {
      page: Number(searchParams.get("page") ?? 1),
      limit: Number(searchParams.get("limit") ?? defaults.limit ?? 25),
      ordering: searchParams.get("ordering") ?? defaults.ordering ?? "-id",
    };
    for (const [key, value] of searchParams.entries()) {
      if (["page", "limit", "ordering"].includes(key)) continue;
      const existing = result[key];
      // Repeated keys (?status=A&status=B) become an array.
      if (existing === undefined) result[key] = value;
      else if (Array.isArray(existing)) (existing as string[]).push(value);
      else result[key] = [existing as string, value];
    }
    return result as FilterState;
  }, [searchParams, defaults.limit, defaults.ordering]);

  const setFilters = useCallback(
    (updates: Record<string, unknown>, options?: { resetPage?: boolean }) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(updates)) {
          next.delete(key);
          if (value === undefined || value === null || value === "" ||
              (Array.isArray(value) && value.length === 0)) {
            continue;
          }
          if (Array.isArray(value)) value.forEach((v) => next.append(key, String(v)));
          else next.set(key, String(value));
        }
        // Any filter change returns to page 1; staying on page 7 of a
        // now-shorter result set shows an empty screen.
        if (options?.resetPage !== false && !("page" in updates)) next.set("page", "1");
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  /** Filters the user actively set, for the "N filters" chip. */
  const activeCount = useMemo(() => {
    let count = 0;
    for (const key of searchParams.keys()) {
      if (!["page", "limit", "ordering"].includes(key)) count += 1;
    }
    return count;
  }, [searchParams]);

  return { filters, setFilters, clearFilters, activeCount };
}
