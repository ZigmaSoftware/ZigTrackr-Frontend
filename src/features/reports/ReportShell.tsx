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

/* ---- ONE REPORT SHELL ----
   Nine reports share filters, a table, an export button and print styling.
   Each report is a config; the shell is written once (spec 3). */

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
  renderSummary?: (data: unknown) => React.ReactNode;
}

export function ReportShell<T extends Record<string, unknown>>({
  config,
}: { config: ReportConfig<T> }) {
  const [date, setDate] = useState(todayIso());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
            <div className="mb-4">{config.renderSummary(data)}</div>
          ) : null}

          {config.columns ? (
            <Card className="overflow-hidden">
              <DataTable
                columns={config.columns}
                rows={rows}
                // Index is part of the key because several reports return
                // aggregate rows with no id/code (aging bands, for example),
                // and a colliding key silently collapses them into one row.
                rowKey={(row, index) => String(row.id ?? row.code ?? row.name ?? index)}
                emptyTitle="No data for this report"
                emptyDescription="Try a different date range."
              />
            </Card>
          ) : null}
        </>
      )}
    </>
  );
}
