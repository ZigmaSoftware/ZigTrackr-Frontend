import { get } from "@/api/client";

export const categories = ["unassigned", "assigned", "rectified", "closed"] as const;
export type Category = typeof categories[number];
export type Tab = Category | "all";
export type Counts = Record<Tab | "other", number>;
export const emptyCounts: Counts = { all: 0, unassigned: 0, assigned: 0, rectified: 0, closed: 0, other: 0 };
export interface DailyRow {
  kind: string; row_id: string; ticket_uuid: string; reference: string;
  request_title: string; ticket_type: string; project_name: string;
  category: Category | "other"; text: string; at: string;
  owner_name: string; owner_role: string; actor_name: string;
  priority_name: string; priority_color: string;
}
export interface DailyResults {
  counts: Counts; count: number; page: number; total_pages: number;
  results: DailyRow[]; today: string; timezone: string;
}
export interface CalendarResults { days: Record<string, Counts>; today: string; timezone: string }
export const dailyApi = {
  list: (params: Record<string, unknown>) => get<DailyResults>("/tickets/daily-updates/", params),
  calendar: (month: string) => get<CalendarResults>("/tickets/daily-updates/calendar/", { month }),
};
