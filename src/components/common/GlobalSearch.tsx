import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Modal } from "@/components/feedback/Modal";
import { Input, Spinner } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/common/badges";
import { bugApi } from "@/api/services";
import { NAVIGATION, filterNavigation, flattenNavigation } from "@/config/navigation";
import { useAuth } from "@/features/auth/AuthContext";

/* Spec 53: global search across bug number, title, project, module and owner,
   with results grouped and clickable. Menus are included because a user
   looking for "overdue" usually wants the screen, not one bug. */
export function GlobalSearch({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  // Debounced so typing does not fire a request per keystroke (spec 47).
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => { if (!open) { setTerm(""); setDebounced(""); } }, [open]);

  // ⌘K / Ctrl+K
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange]);

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: () => bugApi.list({ search: debounced, limit: 8 }),
    enabled: debounced.length >= 2,
  });

  const menuMatches = useMemo(() => {
    if (debounced.length < 2) return [];
    const items = flattenNavigation(filterNavigation(NAVIGATION, can));
    return items
      .filter((item) => item.label.toLowerCase().includes(debounced.toLowerCase()))
      .slice(0, 4);
  }, [debounced, can]);

  function go(path: string) {
    navigate(path);
    onOpenChange(false);
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Search" size="lg">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" aria-hidden />
        <Input
          autoFocus
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search bug number, title, project, module or owner…"
          className="pl-9"
          aria-label="Search bugs and screens"
        />
      </div>

      {debounced.length < 2 ? (
        <p className="py-6 text-center text-[13px] text-[var(--muted-foreground)]">
          Type at least two characters to search.
        </p>
      ) : (
        <div className="space-y-4">
          {menuMatches.length > 0 ? (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Screens
              </p>
              <ul>
                {menuMatches.map((item) => (
                  <li key={item.to}>
                    <button
                      type="button"
                      onClick={() => go(item.to)}
                      className="w-full rounded px-2 py-1.5 text-left text-[13px] hover:bg-[var(--muted)]"
                    >
                      {item.label}
                      <span className="ml-2 text-[11px] text-[var(--muted-foreground)]">{item.group}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Bugs {isFetching ? <Spinner className="size-3" /> : null}
            </p>
            {!data || data.results.length === 0 ? (
              <p className="px-2 py-3 text-[13px] text-[var(--muted-foreground)]">
                No bugs match “{debounced}”.
              </p>
            ) : (
              <ul>
                {data.results.map((bug) => (
                  <li key={bug.id}>
                    <button
                      type="button"
                      onClick={() => go(`/bugs/detail/${bug.id}`)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-[var(--muted)]"
                    >
                      <span className="shrink-0 text-[12px] font-medium text-[var(--primary)]">
                        {bug.bug_no}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px]">{bug.title}</span>
                      <StatusBadge status={bug.status} label={bug.status_label} showIcon={false} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
