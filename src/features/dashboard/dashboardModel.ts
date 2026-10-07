import type { ChartDatum } from "@/types";

export type WorkTab = "all" | "progress" | "verification";
export type AttentionTab = "overdue" | "critical" | "unassigned";
export type TrendDay = { date: string; opened: number; closed: number };

const count = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;

export function trendForPeriod(rows: unknown[], days: number): TrendDay[] {
  return rows.filter((row): row is TrendDay => typeof row === "object" && row !== null &&
    "date" in row && typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date))
    .map((row) => ({ date: row.date, opened: count(row.opened), closed: count(row.closed) }))
    .sort((a, b) => a.date.localeCompare(b.date)).slice(-days);
}

export function chartRows(rows: unknown[]): ChartDatum[] {
  return rows.filter((row): row is ChartDatum => typeof row === "object" && row !== null &&
    "label" in row && typeof row.label === "string" && "count" in row)
    .map((row) => ({ ...row, count: count(row.count) })).filter((row) => row.count > 0);
}

export function workParams(tab: WorkTab) {
  return { owner: "me", terminal: false, limit: 5, ordering: "-created_at",
    ...(tab === "progress" ? { status: "IN_PROGRESS" } : {}),
    ...(tab === "verification" ? { verification_queue: true } : {}) };
}

export function attentionParams(tab: AttentionTab) {
  return { terminal: false, limit: 5, ordering: "-age_days", [tab]: true };
}

export function shortStatus(code: string, label: string) {
  return code === "TESTING" ? "Rectified" : label.replace(" / Not a Bug", "");
}
