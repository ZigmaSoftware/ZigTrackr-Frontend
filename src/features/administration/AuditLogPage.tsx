import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, Input } from "@/components/ui/primitives";
import { DataTable, TruncatedCell, type Column } from "@/components/tables/DataTable";
import { Pagination } from "@/components/tables/Pagination";
import { ErrorState } from "@/components/feedback/states";
import { formatDateTime } from "@/lib/dates";

type AuditRow = Record<string, unknown>;

const columns: Column<AuditRow>[] = [
  { key: "performed_at", header: "When", width: "w-44",
    cell: (row) => <span className="text-[var(--muted-foreground)]">{formatDateTime(String(row.performed_at))}</span> },
  { key: "performed_by_name", header: "Who", width: "w-40",
    cell: (row) => <span className="font-medium">{String(row.performed_by_name || "System")}</span> },
  { key: "action_label", header: "Action", width: "w-44",
    cell: (row) => <span>{String(row.action_label)}</span> },
  { key: "entity_label", header: "Record", width: "w-36",
    cell: (row) => <span className="font-mono text-[12px]">{String(row.entity_label || "—")}</span> },
  { key: "field_name", header: "Field", width: "w-32", hideBelow: "lg",
    cell: (row) => <span className="text-[var(--muted-foreground)]">{String(row.field_name || "—")}</span> },
  { key: "change", header: "Change", hideBelow: "md",
    cell: (row) => {
      const oldValue = String(row.old_value ?? "");
      const newValue = String(row.new_value ?? "");
      if (!oldValue && !newValue) return <span className="text-[var(--muted-foreground)]">—</span>;
      return (
        <TruncatedCell maxWidth="max-w-[320px]">
          {oldValue ? `${oldValue} → ${newValue}` : newValue}
        </TruncatedCell>
      );
    } },
];

export function AuditLogPage() {
  const { filters, setFilters } = useUrlFilters({ ordering: "-performed_at" });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.audit.list(filters),
    queryFn: () => auditApi.list(filters),
    placeholderData: (previous) => previous,
  });

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Every significant change, permanently recorded."
        breadcrumbs={[{ label: "Administration" }, { label: "Audit Log" }]}
      />
      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border)] p-3">
          <Input
            type="search"
            className="h-8 max-w-xs"
            placeholder="Search bug no or user…"
            aria-label="Search audit log"
            value={(filters.search as string) ?? ""}
            onChange={(event) => setFilters({ search: event.target.value })}
          />
        </div>
        {isError ? <ErrorState onRetry={() => refetch()} /> : (
          <>
            <DataTable
              columns={columns}
              rows={(data?.results as AuditRow[]) ?? []}
              rowKey={(row) => String(row.id)}
              isLoading={isLoading}
              emptyTitle="No audit entries"
            />
            {data && data.count > 0 ? (
              <Pagination
                page={data.page} totalPages={data.total_pages} count={data.count}
                pageSize={filters.limit}
                onPageChange={(page) => setFilters({ page }, { resetPage: false })}
                onPageSizeChange={(limit) => setFilters({ limit })}
              />
            ) : null}
          </>
        )}
      </Card>
    </>
  );
}
