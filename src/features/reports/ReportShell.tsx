import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, RotateCcw } from "lucide-react";
import { reportApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { PageHeader } from "@/components/common/PageHeader";
import { Button, Card, CardBody, Input, Label, Skeleton } from "@/components/ui/primitives";
import { ErrorState } from "@/components/feedback/states";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { todayIso } from "@/lib/dates";
import { DrilldownDrawer, type DrilldownParams } from "./DrilldownDrawer";
import type { BugListRow } from "@/types";

/* ---- ONE REPORT SHELL ----
   Nine reports share filters, a table, an export button and print styling.
   Each report is a config; the shell is written once (spec 3). */

/** Info needed to open the drill-down drawer from a row click. */
export interface DrilldownRequest {
  title: string;
  description?: string;
  /** Query params forwarded to GET /bugs/. */
  params: DrilldownParams;
  /** Override columns for specialised drill-downs. */
  columns?: Column<BugListRow>[];
}

export interface ReportConfig<T = Record<string, unknown>> {
  name: string;
  title: string;
  description: string;
  /** Which filter controls to show. */
  filters?: ("date" | "dateRange")[];
  /** Table columns; omit for reports that render only a summary. */
  columns?: Column<T>[];
  /** Pull the row array out of the response. */
  selectRows?: (data: unknown) => T[];
  /** Render a summary block above the table. */
  renderSummary?: (data: unknown, onDrilldown: (req: DrilldownRequest) => void) => React.ReactNode;
  /** Render a chart block between the summary and the table. */
  renderChart?: (data: unknown) => React.ReactNode;
  /** Build drill-down params from a clicked summary-table row. Return null to skip. */
  drilldownParams?: (row: T) => DrilldownRequest | null;
  /** Custom columns for the drill-down bug table (overrides BUG_COLUMNS). */
  drilldownColumns?: Column<BugListRow>[];
  /** Custom empty state message when the table has no rows. */
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ReportShell<T extends Record<string, unknown>>({
  config,
}: { config: ReportConfig<T> }) {
  const [date, setDate] = useState(todayIso());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [drilldown, setDrilldown] = useState<DrilldownRequest | null>(null);

  const params: Record<string, unknown> = {};
  if (config.filters?.includes("date")) params.date = date;
  if (config.filters?.includes("dateRange")) {
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.reports.one(config.name, params),
    queryFn: () => reportApi.fetch<unknown>(config.name, params),
  });

  const rows = config.selectRows && data ? config.selectRows(data) : ((data as T[]) ?? []);

  const handleRowClick = config.drilldownParams
    ? (row: T) => {
        const req = config.drilldownParams!(row);
        if (req) setDrilldown(req);
      }
    : undefined;

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        breadcrumbs={[{ label: "Reports" }, { label: config.title }]}
        actions={
          <Button variant="outline" size="sm" className="no-print" onClick={() => window.print()}>
            <Printer /> Print
          </Button>
        }
      />

      {config.filters?.length ? (
        <Card className="mb-4 no-print">
          <CardBody className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
            {config.filters.includes("date") ? (
              <div className="space-y-1.5">
                <Label htmlFor="r-date">Report date</Label>
                <Input id="r-date" type="date" className="h-9 w-[170px]"
                       value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            ) : null}
            {config.filters.includes("dateRange") ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="r-from">From</Label>
                  <Input id="r-from" type="date" className="h-9 w-[170px]"
                         value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-to">To</Label>
                  <Input id="r-to" type="date" className="h-9 w-[170px]"
                         value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </>
            ) : null}
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setDate(todayIso()); setDateFrom(""); setDateTo(""); }}>
              <RotateCcw /> Reset dates
            </Button>
          </CardBody>
        </Card>
      ) : null}

      {isError ? (
        <Card><ErrorState onRetry={() => refetch()} /></Card>
      ) : isLoading ? (
        <Card><CardBody className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
        </CardBody></Card>
      ) : (
        <>
          {config.renderSummary ? (
            <div className="mb-4">{config.renderSummary(data, setDrilldown)}</div>
          ) : null}

          {config.renderChart ? (
            <div className="mb-4">{config.renderChart(data)}</div>
          ) : null}

          {config.columns ? (
            <Card className="overflow-hidden">
              <DataTable
                columns={config.columns}
                rows={rows}
                onRowClick={handleRowClick}
                // Index is part of the key because several reports return
                // aggregate rows with no id/code (aging bands, for example),
                // and a colliding key silently collapses them into one row.
                rowKey={(row, index) => String(row.id ?? row.code ?? row.name ?? index)}
                emptyTitle={config.emptyTitle ?? "No data for this report"}
                emptyDescription={config.emptyDescription ?? "Try a different date range."}
              />
            </Card>
          ) : null}
        </>
      )}

      {/* Drill-down drawer — shared across all configs */}
      <DrilldownDrawer
        open={drilldown !== null}
        onOpenChange={(open) => { if (!open) setDrilldown(null); }}
        title={drilldown?.title ?? ""}
        description={drilldown?.description}
        params={drilldown?.params ?? {}}
        columns={drilldown?.columns ?? config.drilldownColumns}
      />
    </>
  );
}
