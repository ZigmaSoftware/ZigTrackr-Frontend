import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, LogOut, Menu, Moon, Plus, Search, Sun, User } from "lucide-react";
import { dashboardApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { useAuth } from "@/features/auth/AuthContext";
import { Sidebar } from "@/layouts/Sidebar";
import { Button, IconButton } from "@/components/ui/primitives";
import { GlobalSearch } from "@/components/common/GlobalSearch";
import { CreateTicketDialog } from "@/features/tickets/dialogs/CreateTicketDialog";
import { useTheme } from "@/hooks/useTheme";
import { longDate } from "@/lib/dates";
import { initials } from "@/lib/utils";

function readCollapsed(): boolean {
  try {
    return JSON.parse(localStorage.getItem("zbt.sidebar.collapsed") ?? "false") as boolean;
  } catch {
    return false;
  }
}

export function AppLayout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  /* Badge counts refresh on a slow interval; they are ambient information, not
     something worth polling aggressively. Workflow actions invalidate them
     immediately, so they are never stale when it matters. */
  const { data: counts } = useQuery({
    queryKey: queryKeys.dashboard.sidebarCounts,
    queryFn: dashboardApi.sidebarCounts,
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <Tooltip.Provider>
      <div className="flex min-h-svh bg-[var(--background)]">
        <Sidebar
          counts={counts}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          mobileOpen={mobileOpen}
          onMobileOpenChange={setMobileOpen}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Skip link: first focusable element on the page (spec 49). */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50
                       focus:rounded-md focus:bg-[var(--primary)] focus:px-3 focus:py-2
                       focus:text-[var(--primary-foreground)]"
          >
            Skip to content
          </a>

          {/* ---- TOPBAR (spec 21.1) ---- */}
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--card)] px-3 sm:px-4">
            <IconButton label="Open navigation" className="lg:hidden"
                        onClick={() => setMobileOpen(true)}>
              <Menu />
            </IconButton>

            <div className="hidden min-w-0 flex-col sm:flex">
              <p className="truncate text-[13px] font-semibold leading-tight">ZigTrackr</p>
              <p className="truncate text-[11px] text-[var(--muted-foreground)]">{longDate()}</p>
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex h-8 items-center gap-2 rounded-md border border-[var(--input)] bg-[var(--background)]
                           px-2.5 text-[13px] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                aria-label="Search bugs, projects and modules"
              >
                <Search className="size-3.5" aria-hidden />
                <span className="hidden md:inline">Search…</span>
                <kbd className="hidden rounded border border-[var(--border)] px-1 text-[10px] md:inline">⌘K</kbd>
              </button>

              {can("tickets.ticket.create") ? (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus /> <span className="hidden sm:inline">Create Ticket</span>
                </Button>
              ) : null}

              <IconButton label="Notifications" onClick={() => navigate("/notifications")}>
                <Bell />
              </IconButton>

              <IconButton
                label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                onClick={toggleTheme}
              >
                {theme === "dark" ? <Sun /> : <Moon />}
              </IconButton>

              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="grid size-8 place-items-center rounded-full bg-[var(--primary)] text-[11px]
                               font-semibold text-[var(--primary-foreground)]"
                    aria-label="Account menu"
                  >
                    {initials(user?.name ?? "U")}
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={6}
                    className="z-50 min-w-[200px] rounded-lg border border-[var(--border)] bg-[var(--popover)] p-1 shadow-[var(--shadow-pop)]"
                  >
                    <div className="px-2.5 py-2">
                      <p className="truncate text-[13px] font-medium">{user?.name}</p>
                      <p className="truncate text-[11px] text-[var(--muted-foreground)]">
                        {user?.roles?.map((r) => r.name).join(", ") || user?.email}
                      </p>
                    </div>
                    <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
                    <DropdownMenu.Item
                      onSelect={() => navigate("/profile")}
                      className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-[13px] outline-none data-[highlighted]:bg-[var(--muted)]"
                    >
                      <User className="size-3.5" aria-hidden /> Profile & password
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={handleLogout}
                      className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-[13px] text-[var(--destructive)] outline-none data-[highlighted]:bg-[var(--muted)]"
                    >
                      <LogOut className="size-3.5" aria-hidden /> Sign out
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </header>

          <main id="main-content" className="min-w-0 max-w-full flex-1 overflow-x-hidden p-3 sm:p-4 lg:p-5">
            <Outlet />
          </main>
        </div>

        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
        <CreateTicketDialog open={createOpen} onOpenChange={setCreateOpen} />
      </div>
    </Tooltip.Provider>
  );
}
