import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, Inbox, MessageSquarePlus, MoreHorizontal, Plus } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { bugApi, reportApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { useAuth } from "@/features/auth/AuthContext";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { BUG_PRESETS } from "@/config/bugPresets";
import { PageHeader } from "@/components/common/PageHeader";
import { BugFilterPanel } from "@/components/filters/BugFilterPanel";
import { DataTable, TruncatedCell, type Column } from "@/components/tables/DataTable";
import { Pagination } from "@/components/tables/Pagination";
import { Button, Card, IconButton } from "@/components/ui/primitives";
import { ErrorState } from "@/components/feedback/states";
import {
  AgeCell, OverdueBadge, PriorityBadge, SeverityBadge, StatusBadge, UpdatePendingBadge,
} from "@/components/common/badges";
import { AddUpdateDialog } from "@/features/bugs/dialogs/AddUpdateDialog";
import { formatDate, relativeTime } from "@/lib/dates";
import { apiErrorMessage } from "@/api/client";
import type { BugListRow } from "@/types";

/* ---- THE BUG LIST ----
   All nine sidebar views render through this one component; the route supplies
   a preset key and nothing else differs (spec 18). */
export function BugListPage({ presetKey }: { presetKey?: string }) {
  const params = useParams();
  const navigate = useNavigate();
  const { can, user } = useAuth();
  const preset = BUG_PRESETS[presetKey ?? params.preset ?? "all"] ?? BUG_PRESETS.all;

  const { filters, setFilters, clearFilters, activeCount } = useUrlFilters({
    ordering: preset.ordering ?? "-id",
  });
  const [updateTarget, setUpdateTarget] = useState<BugListRow | null>(null);

  /* The preset's filters are merged server-side and are not user-removable:
     "Overdue Bugs" that can be un-overdued would just be All Bugs. */
  const queryParams = useMemo(
    () => ({ ...filters, ...preset.filters }),
    [filters, preset.filters],
  );

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.bugs.list(queryParams),
    queryFn: () => bugApi.list(queryParams),
    placeholderData: (previous) => previous,
    refetchInterval: 30_000,
  });

  const columns = useMemo<Column<BugListRow>[]>(() => [
    {
      key: "bug_no",
      header: "Bug No",
      sortable: true,
      width: "w-[132px]",
      cell: (row) => (
        <Link
          to={`/bugs/detail/${row.id}`}
          className="whitespace-nowrap font-medium text-[var(--primary)] hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {row.bug_no}
        </Link>
      ),
    },
    {
      key: "reported_date",
      header: "Reported",
      sortable: true,
      width: "w-[108px]",
      hideBelow: "lg",
      cell: (row) => (
        <span className="whitespace-nowrap text-[var(--muted-foreground)]">
          {formatDate(row.reported_date)}
        </span>
      ),
    },
    {
      key: "project",
      header: "Project",
      hideBelow: "xl",
      cell: (row) => <TruncatedCell maxWidth="max-w-[120px]">{row.project?.name ?? "—"}</TruncatedCell>,
    },
    {
      key: "module",
      header: "Module",
      hideBelow: "xl",
      cell: (row) => <TruncatedCell maxWidth="max-w-[120px]">{row.module?.name ?? "—"}</TruncatedCell>,
    },
    {
      key: "title",
      header: "Title",
      sortable: true,
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-1.5">
          <TruncatedCell maxWidth="max-w-[320px]" className="font-medium">{row.title}</TruncatedCell>
          {row.reopen_count > 0 ? (
            <span
              className="shrink-0 rounded bg-[var(--status-reopened-bg)] px-1 text-[10px] font-medium text-[var(--status-reopened-fg)]"
              title={`Reopened ${row.reopen_count} time${row.reopen_count === 1 ? "" : "s"}`}
            >
              ↻{row.reopen_count}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "priority__rank",
      header: "Priority",
      sortable: true,
      width: "w-[112px]",
      cell: (row) => row.priority
        ? <PriorityBadge code={row.priority.code} label={row.priority.name} />
        : <span className="text-[var(--muted-foreground)]">—</span>,
    },
    {
      key: "severity__rank",
      header: "Severity",
      sortable: true,
      width: "w-[112px]",
      hideBelow: "lg",
      cell: (row) => row.severity
        ? <SeverityBadge code={row.severity.code} label={row.severity.name} />
        : <span className="text-[var(--muted-foreground)]">—</span>,
    },
    {
      key: "owner",
      header: "Owner",
      width: "w-[132px]",
      hideBelow: "md",
      cell: (row) => row.owner
        ? <TruncatedCell maxWidth="max-w-[120px]">{row.owner.name}</TruncatedCell>
        : <span className="text-[11px] text-[var(--priority-medium-fg)]">Unassigned</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      width: "w-[132px]",
      cell: (row) => <StatusBadge status={row.status} label={row.status_label} />,
    },
    {
      key: "age_days",
      header: "Age",
      sortable: true,
      width: "w-[72px]",
      hideBelow: "md",
      cell: (row) => <AgeCell days={row.age_days} band={row.aging_band} />,
    },
    {
      key: "expected_closure_date",
      header: "Expected",
      sortable: true,
      width: "w-[196px]",
      hideBelow: "lg",
      cell: (row) => (
        <div className="flex flex-nowrap items-center gap-1.5">
          <span className="whitespace-nowrap text-[var(--muted-foreground)]">
            {formatDate(row.expected_closure_date)}
          </span>
          {row.is_overdue ? <OverdueBadge days={row.overdue_days} /> : null}
        </div>
      ),
    },
    {
      key: "latest_update_at",
      header: "Last Update",
      sortable: true,
      width: "w-[188px]",
      hideBelow: "xl",
      cell: (row) => (
        <div className="flex flex-nowrap items-center gap-1.5">
          <span className="whitespace-nowrap text-[var(--muted-foreground)]">
            {relativeTime(row.latest_update_at)}
          </span>
          {row.is_update_pending ? <UpdatePendingBadge days={row.days_since_update} /> : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "w-[86px]",
      align: "right",
      cell: (row) => (
        // Spec 26: a view icon, a quick action, and everything else behind a
        // menu -- not a row of eight icons.
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <IconButton label={`View ${row.bug_no}`} onClick={() => navigate(`/bugs/detail/${row.id}`)}>
            <Eye />
          </IconButton>
          {row.can_mutate && can("bugs.update.add") ? (
            <IconButton label={`Add update to ${row.bug_no}`} onClick={() => setUpdateTarget(row)}>
              <MessageSquarePlus />
            </IconButton>
          ) : null}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <IconButton label={`More actions for ${row.bug_no}`}>
                <MoreHorizontal />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                className="z-50 min-w-[170px] rounded-lg border border-[var(--border)] bg-[var(--popover)] p-1 shadow-[var(--shadow-pop)]"
              >
                <MenuItem onSelect={() => navigate(`/bugs/detail/${row.id}`)}>Open bug</MenuItem>
                {row.can_mutate && can("bugs.bug.edit") ? (
                  <MenuItem onSelect={() => navigate(`/bugs/detail/${row.id}?tab=overview&edit=1`)}>
                    Edit details
                  </MenuItem>
                ) : null}
                {row.can_mutate && can("bugs.bug.assign") ? (
                  <MenuItem onSelect={() => navigate(`/bugs/detail/${row.id}?action=assign`)}>
                    {row.owner ? "Reassign owner" : "Assign owner"}
                  </MenuItem>
                ) : null}
                {row.can_mutate && can("bugs.bug.change_status") ? (
                  <MenuItem onSelect={() => navigate(`/bugs/detail/${row.id}?action=status`)}>
                    Update status
                  </MenuItem>
                ) : null}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      ),
    },
  ], [can, navigate]);

  async function handleExport() {
    try {
      const blob = await reportApi.exportBugs({ ...queryParams, limit: undefined, page: undefined });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${preset.key}-bugs-${new Date().toISOString().slice(0, 10)}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Unable to export."));
    }
  }

  const lockedKeys = Object.keys(preset.filters);

  return (
    <>
      <PageHeader
        title={preset.title}
        description={preset.description}
        breadcrumbs={[{ label: "Bug Management" }, { label: preset.title }]}
        actions={
          <>
            {can("reports.report.export") ? (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download /> <span className="hidden sm:inline">Export</span>
              </Button>
            ) : null}
            {can("bugs.bug.add") ? (
              <Button size="sm" onClick={() => navigate("/bugs/new")}>
                <Plus /> New Bug
              </Button>
            ) : null}
          </>
        }
      />

      {preset.key === "all" && !can("bugs.bug.view_all") && !can("bugs.bug.view_team") ? (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-sky-500/25 bg-sky-500/5 px-4 py-3 text-sm">
          <Inbox className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />
          <p><span className="font-semibold">Email bugs appear here as soon as intake creates them.</span> Unassigned email bugs are read-only for developers until a team lead or administrator routes them.</p>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border)] p-3">
          <BugFilterPanel
            filters={filters}
            onChange={setFilters}
            onClear={clearFilters}
            activeCount={activeCount}
            lockedKeys={lockedKeys}
          />
        </div>

        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (
          <>
            <div className={isFetching && !isLoading ? "opacity-60 transition-opacity" : undefined}>
              <DataTable
                columns={columns}
                rows={data?.results ?? []}
                rowKey={(row) => row.id}
                isLoading={isLoading}
                ordering={filters.ordering}
                onOrderingChange={(ordering) => setFilters({ ordering })}
                onRowClick={(row) => navigate(`/bugs/detail/${row.id}`)}
                emptyTitle={preset.emptyTitle}
                emptyDescription={preset.emptyDescription}
                rowClassName={(row) =>
                  row.is_overdue ? "bg-[var(--priority-critical-bg)]/25" : undefined
                }
              />
            </div>

            {data && data.count > 0 ? (
              <Pagination
                page={data.page}
                totalPages={data.total_pages}
                count={data.count}
                pageSize={filters.limit}
                onPageChange={(page) => setFilters({ page }, { resetPage: false })}
                onPageSizeChange={(limit) => setFilters({ limit })}
              />
            ) : null}
          </>
        )}
      </Card>

      {updateTarget ? (
        <AddUpdateDialog
          bugId={updateTarget.id}
          bugNo={updateTarget.bug_no}
          open
          onOpenChange={(open) => !open && setUpdateTarget(null)}
        />
      ) : null}
    </>
  );
}

function MenuItem({
  children, onSelect,
}: { children: React.ReactNode; onSelect: () => void }) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="cursor-pointer rounded px-2.5 py-1.5 text-[13px] outline-none data-[highlighted]:bg-[var(--muted)]"
    >
      {children}
    </DropdownMenu.Item>
  );
}
