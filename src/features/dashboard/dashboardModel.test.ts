import { describe, expect, it } from "vitest";
import { attentionParams, chartRows, shortStatus, trendForPeriod, workParams } from "./dashboardModel";

describe("dashboard presentation", () => {
  it("switches time windows without inventing trend values", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, "0")}`, opened: i, closed: 1 }));
    const week = trendForPeriod(rows.reverse(), 7);
    expect(week).toHaveLength(7);
    expect(week[0].date).toBe("2026-09-24");
    expect(week.at(-1)?.opened).toBe(29);
    expect(trendForPeriod([], 30)).toEqual([]);
  });
  it("ignores malformed data and sanitizes counts", () => {
    expect(chartRows([null, {}, { label: "Empty", count: 0 }, { label: "Bad", count: -1 }, { label: "Bad", count: NaN }, { code: "HIGH", label: "High", count: 4 }])).toEqual([{ code: "HIGH", label: "High", count: 4 }]);
    expect(trendForPeriod([{}, { date: "bad", opened: 99 }, { date: "2026-10-05", opened: -1, closed: Infinity }], 7)).toEqual([{ date: "2026-10-05", opened: 0, closed: 0 }]);
  });
  it("requests unified personal work without restricting ticket type", () => {
    expect(workParams("all")).toMatchObject({ owner: "me", terminal: false, limit: 5 });
    expect(workParams("all")).not.toHaveProperty("ticket_type");
    expect(workParams("progress")).toHaveProperty("status", "IN_PROGRESS");
    expect(workParams("verification")).toHaveProperty("verification_queue", true);
  });
  it("attention queues exclude terminal tickets", () => {
    for (const tab of ["overdue", "critical", "unassigned"] as const) expect(attentionParams(tab)).toMatchObject({ terminal: false, [tab]: true, limit: 5 });
  });
  it("uses the current rectification wording", () => {
    expect(shortStatus("TESTING", "Testing / Verification")).toBe("Rectified");
    expect(shortStatus("IN_PROGRESS", "In Progress")).toBe("In Progress");
  });
});
