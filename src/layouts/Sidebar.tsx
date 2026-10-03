import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  ChevronDown, PanelLeftClose, PanelLeftOpen, Pin, PinOff, Radar, Search, Star, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/AuthContext";
import { NAVIGATION, filterNavigation, flattenNavigation, type NavItem } from "@/config/navigation";
import type { SidebarCounts } from "@/types";

const STORAGE = {
  collapsed: "zbt.sidebar.collapsed",
  expandedGroups: "zbt.sidebar.groups",
  favorites: "zbt.sidebar.favorites",
};

/* localStorage here is a per-viewer convenience only (which groups are open,
   which screens are pinned). It is never used for anything the server needs to
   know, and every read is guarded because private windows can throw. */
function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage unavailable; the UI still works, it just will not remember. */
  }
}

const BADGE_TONE: Record<string, string> = {
  default: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  warning: "bg-[var(--priority-medium-bg)] text-[var(--priority-medium-fg)]",
  danger: "bg-[var(--priority-critical-bg)] text-[var(--priority-critical-fg)]",
};

interface SidebarProps {
  counts?: SidebarCounts;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export function Sidebar({
  counts, collapsed, onCollapsedChange, mobileOpen, onMobileOpenChange,
}: SidebarProps) {
  const { can } = useAuth();
  const location = useLocation();
  const searchRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string[]>(() =>
    readStorage(STORAGE.expandedGroups, ["dashboard", "tickets", "bugs", "daily"]));
  const [favorites, setFavorites] = useState<string[]>(() =>
    readStorage(STORAGE.favorites, []));

  const sections = useMemo(() => filterNavigation(NAVIGATION, can), [can]);
  const allItems = useMemo(() => flattenNavigation(sections), [sections]);

  /* Spec 17.4: typing "over" should immediately surface Overdue Bugs and
     Overdue Report. */
  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return allItems
      .filter((item) =>
        item.label.toLowerCase().includes(term) || item.group.toLowerCase().includes(term))
      .slice(0, 8);
  }, [query, allItems]);

  const favoriteItems = useMemo(
    () => allItems.filter((item) => favorites.includes(item.to)),
    [allItems, favorites],
  );

  useEffect(() => writeStorage(STORAGE.expandedGroups, expanded), [expanded]);
  useEffect(() => writeStorage(STORAGE.favorites, favorites), [favorites]);

  // Close the mobile drawer whenever navigation happens (spec 48).
  useEffect(() => { onMobileOpenChange(false); }, [location.pathname]);

  // "/" focuses menu search, the way a power user expects.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (event.key === "/" && !typing && !collapsed) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [collapsed]);

  function toggleGroup(id: string) {
    setExpanded((current) =>
      current.includes(id) ? current.filter((g) => g !== id) : [...current, id]);
  }

  function toggleFavorite(to: string) {
    setFavorites((current) =>
      current.includes(to) ? current.filter((f) => f !== to) : [...current, to]);
  }

  function badgeValue(item: NavItem): number | null {
    if (!item.badge || !counts) return null;
    const value = counts[item.badge];
    return value > 0 ? value : null;
  }

  const width = collapsed ? "w-[64px]" : "w-[264px]";

  return (
    <>
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => onMobileOpenChange(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          "z-50 flex shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)]",
          "transition-[width] duration-200 ease-out",
          width,
          "fixed inset-y-0 left-0 lg:sticky lg:top-0 lg:h-svh lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
        aria-label="Main navigation"
      >
        {/* ---- BRAND ---- */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--sidebar-border)] px-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]">
            <Radar className="size-4" aria-hidden />
          </div>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight">ZigTrackr</p>
              <p className="truncate text-[11px] text-[var(--muted-foreground)]">Issue Management</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => onMobileOpenChange(false)}
            className="ml-auto rounded p-1 hover:bg-[var(--muted)] lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {/* ---- MENU SEARCH (spec 17.4) ---- */}
        {!collapsed ? (
          <div className="px-3 py-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" aria-hidden />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search menu…  /"
                aria-label="Search menu"
                className="h-8 w-full rounded-md border border-[var(--input)] bg-[var(--background)] pl-8 pr-2 text-[13px]
                           placeholder:text-[var(--muted-foreground)] focus-visible:border-[var(--ring)]"
              />
            </div>
          </div>
        ) : null}

        <nav className="flex-1 overflow-y-auto px-3 pb-5 pt-1">
          {/* ---- SEARCH RESULTS ---- */}
          {query.trim() && !collapsed ? (
            <div className="mb-2">
              <SectionLabel>Results</SectionLabel>
              {searchResults.length === 0 ? (
                <p className="px-2.5 py-2 text-[12px] text-[var(--muted-foreground)]">
                  No menu matches “{query}”.
                </p>
              ) : (
                searchResults.map((item) => (
                  <ItemLink
                    key={item.to}
                    item={item}
                    collapsed={false}
                    badge={badgeValue(item)}
                    isFavorite={favorites.includes(item.to)}
                    onToggleFavorite={toggleFavorite}
                    hint={item.group}
                    onNavigate={() => setQuery("")}
                  />
                ))
              )}
            </div>
          ) : null}

          {/* ---- QUICK ACCESS (spec 17.5) ---- */}
          {!query.trim() && !collapsed && favoriteItems.length > 0 ? (
            <div className="mb-2">
              <SectionLabel>
                <Star className="size-3 fill-current" aria-hidden /> Quick Access
              </SectionLabel>
              {favoriteItems.map((item) => (
                <ItemLink
                  key={item.to}
                  item={item}
                  collapsed={false}
                  badge={badgeValue(item)}
                  isFavorite
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          ) : null}

          {/* ---- SECTIONS ---- */}
          {!query.trim()
            ? sections.map((section) => (
                <div key={section.label} className="mb-3 border-t border-[var(--sidebar-border)] pt-2 first:border-0 first:pt-0">
                  {!collapsed ? <SectionLabel>{section.label}</SectionLabel> : null}
                  {section.groups.map((group) => {
                    const single = group.items.length === 1;
                    const isOpen = expanded.includes(group.id);

                    if (single || collapsed) {
                      return group.items.map((item) => (
                        <ItemLink
                          key={item.to}
                          item={item}
                          collapsed={collapsed}
                          badge={badgeValue(item)}
                          isFavorite={favorites.includes(item.to)}
                          onToggleFavorite={toggleFavorite}
                        />
                      ));
                    }

                    return (
                      <div key={group.id} className="mb-1">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.id)}
                          aria-expanded={isOpen}
                          className="flex min-h-9 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-semibold
                                     text-[var(--sidebar-foreground)] hover:bg-[var(--muted)]"
                        >
                          <group.icon className="size-4 shrink-0" aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
                          <ChevronDown
                            className={cn("size-3.5 transition-transform duration-200",
                              isOpen ? "rotate-0" : "-rotate-90")}
                            aria-hidden
                          />
                        </button>
                        {isOpen ? (
                          <div className="ml-[17px] mt-1 space-y-0.5 border-l border-[var(--sidebar-border)] pl-2">
                            {group.items.map((item) => (
                              <ItemLink
                                key={item.to}
                                item={item}
                                collapsed={false}
                                badge={badgeValue(item)}
                                isFavorite={favorites.includes(item.to)}
                                onToggleFavorite={toggleFavorite}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))
            : null}
        </nav>

        {/* ---- COLLAPSE TOGGLE (spec 17.3) ---- */}
        <div className="hidden shrink-0 border-t border-[var(--sidebar-border)] p-2 lg:block">
          <button
            type="button"
            onClick={() => {
              onCollapsedChange(!collapsed);
              writeStorage(STORAGE.collapsed, !collapsed);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px]
                       text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" aria-hidden />
                       : <PanelLeftClose className="size-4" aria-hidden />}
            {!collapsed ? <span>Collapse</span> : null}
          </button>
        </div>
      </aside>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1 px-2.5 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
      {children}
    </p>
  );
}

function ItemLink({
  item, collapsed, badge, isFavorite, onToggleFavorite, hint, onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  badge: number | null;
  isFavorite: boolean;
  onToggleFavorite: (to: string) => void;
  hint?: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  const link = (
    <NavLink
      to={item.to}
      end
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group relative flex min-h-9 items-center gap-2.5 rounded-lg py-2 text-[13px] transition-colors",
          collapsed ? "justify-center px-0" : "px-2.5",
          // Spec 17.7: soft background plus a left accent, not an over-bright fill.
          isActive
            ? "bg-[var(--sidebar-accent)] font-medium text-[var(--accent-foreground)] before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--primary)]"
            : "text-[var(--sidebar-foreground)] hover:bg-[var(--muted)]",
          item.emphasis && !collapsed && "text-[var(--primary)]",
        )
      }
    >
      {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {hint ? (
            <span className="text-[10px] text-[var(--muted-foreground)]">{hint}</span>
          ) : null}
          {badge !== null ? (
            <span className={cn(
              "min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums",
              BADGE_TONE[item.badgeTone ?? "default"],
            )}>
              {badge}
            </span>
          ) : null}
          <button
            type="button"
            onClick={(event) => { event.preventDefault(); onToggleFavorite(item.to); }}
            className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
            aria-label={isFavorite ? `Unpin ${item.label}` : `Pin ${item.label} to Quick Access`}
          >
            {isFavorite ? <PinOff className="size-3" aria-hidden />
                        : <Pin className="size-3" aria-hidden />}
          </button>
        </>
      ) : badge !== null ? (
        <span
          className="absolute right-1 top-1 grid min-w-[15px] place-items-center rounded-full
                     bg-[var(--primary)] px-1 text-[9px] font-semibold text-[var(--primary-foreground)]"
          aria-hidden
        >
          {badge}
        </span>
      ) : null}
    </NavLink>
  );

  /* Collapsed mode needs the label somewhere reachable (spec 17.3). */
  if (!collapsed) return link;

  return (
    <Tooltip.Root delayDuration={0}>
      <Tooltip.Trigger asChild>{link}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={6}
          className="z-50 rounded-md bg-[var(--foreground)] px-2 py-1 text-[12px] text-[var(--background)] shadow-md"
        >
          {item.label}
          {badge !== null ? ` (${badge})` : ""}
          <Tooltip.Arrow className="fill-[var(--foreground)]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
