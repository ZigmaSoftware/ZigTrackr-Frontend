import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { teamApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardBody, CardHeader, CardTitle, Skeleton } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { OverdueBadge, PriorityBadge, StatusBadge } from "@/components/common/badges";
import { formatDate } from "@/lib/dates";
import type { BugListRow, WorkloadRow } from "@/types";

const workloadColumns: Column<WorkloadRow>[] = [
  { key: "name", header: "Developer", cell: (row) => <span className="font-medium">{row.name}</span> },
  { key: "assigned", header: "Assigned", align: "right", width: "w-24",
    cell: (row) => <span className="tabular-nums">{row.assigned}</span> },
  { key: "in_progress", header: "In Progress", align: "right", width: "w-28",
    cell: (row) => <span className="tabular-nums">{row.in_progress}</span> },
  { key: "testing", header: "Testing", align: "right", width: "w-24",
    cell: (row) => <span className="tabular-nums">{row.testing}</span> },
  { key: "critical", header: "Critical", align: "right", width: "w-24",
    cell: (row) => (
      <span className={row.critical > 0 ? "font-medium tabular-nums text-[var(--destructive)]" : "tabular-nums"}>
        {row.critical}
      </span>
    ) },
  { key: "overdue", header: "Overdue", align: "right", width: "w-24",
    cell: (row) => (
      <span className={row.overdue > 0 ? "font-medium tabular-nums text-[var(--destructive)]" : "tabular-nums"}>
        {row.overdue}
      </span>
    ) },
  { key: "update_pending", header: "No Update", align: "right", width: "w-28",
    cell: (row) => (
      <span className={row.update_pending > 0 ? "font-medium tabular-nums text-[var(--warning)]" : "tabular-nums"}>
        {row.update_pending}
      </span>
    ) },
  { key: "total_open", header: "Open", align: "right", width: "w-20",
    cell: (row) => <span className="font-semibold tabular-nums">{row.total_open}</span> },
];

export function TeamWorkloadPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.team.workload,
    queryFn: teamApi.workload,
  });

  return (
    <>
      <PageHeader
        title="Developer Workload"
        description="Open work per developer. Use it to balance load and spot bottlenecks — not as a productivity score, since bug complexity varies."
        breadcrumbs={[{ label: "Team Management" }, { label: "Workload" }]}
      />
      <Card className="overflow-hidden">
        {isError ? <ErrorState onRetry={() => refetch()} /> : (
          <DataTable
            columns={workloadColumns}
            rows={data ?? []}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            emptyTitle="No assigned work"
            emptyDescription="Nobody currently owns an open bug."
          />
        )}
      </Card>
    </>
  );
}

export function AssignmentBoardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.team.assignmentBoard,
    queryFn: teamApi.assignmentBoard,
  });

  return (
    <>
      <PageHeader
        title="Bug Assignment"
        description="Unassigned bugs, alongside current workload so you can assign with context."
        breadcrumbs={[{ label: "Team Management" }, { label: "Assignment" }]}
      />

      {isError ? <Card><ErrorState onRetry={() => refetch()} /></Card> : (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Waiting for an owner ({data?.unassigned.length ?? 0})</CardTitle>
            </CardHeader>
            <CardBody>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : !data?.unassigned.length ? (
                <EmptyState title="Everything is assigned"
                            description="No bug is currently waiting for an owner." />
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {data.unassigned.map((bug: BugListRow) => (
                    <li key={bug.id} className="py-2.5">
                      <Link to={`/bugs/detail/${bug.id}?action=assign`}
                            className="block rounded px-1.5 py-1 hover:bg-[var(--muted)]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[12px] font-medium text-[var(--primary)]">{bug.bug_no}</span>
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{bug.title}</span>
                          {bug.priority ? (
                            <PriorityBadge code={bug.priority.code} label={bug.priority.name} />
                          ) : null}
                          <StatusBadge status={bug.status} label={bug.status_label} showIcon={false} />
                          {bug.is_overdue ? <OverdueBadge days={bug.overdue_days} /> : null}
                        </div>
                        <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                          Reported {formatDate(bug.reported_date)} · {bug.project?.name}
                          {bug.module ? ` / ${bug.module.name}` : ""}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Current workload</CardTitle></CardHeader>
            <CardBody>
              {isLoading ? <Skeleton className="h-32" /> : !data?.workload.length ? (
                <p className="text-[13px] text-[var(--muted-foreground)]">No workload data.</p>
              ) : (
                <ul className="space-y-2">
                  {data.workload.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[13px]">{row.name}</span>
                      <span className="flex shrink-0 items-center gap-1.5 text-[11px]">
                        <span className="rounded bg-[var(--muted)] px-1.5 py-0.5 tabular-nums">
                          {row.total_open} open
                        </span>
                        {row.overdue > 0 ? (
                          <span className="rounded bg-[var(--priority-critical-bg)] px-1.5 py-0.5 tabular-nums text-[var(--priority-critical-fg)]">
                            {row.overdue} late
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
