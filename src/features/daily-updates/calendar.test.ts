import { describe, expect, it } from "vitest";
import { calendarDays, inSelection, selectDate, shiftDate, shiftMonth, type DateSelection } from "./calendar";

describe("daily activity date selection", () => {
  const blank: DateSelection = { range: true, from: null, to: null };
  it("replaces a single date instead of multi-selecting", () => {
    expect(selectDate({ range: false, from: "2026-10-05", to: "2026-10-05" }, "2026-10-06"))
      .toEqual({ range: false, from: "2026-10-06", to: "2026-10-06" });
  });
  it("takes From first, To second, and includes endpoints", () => {
    const from = selectDate(blank, "2026-10-02");
    expect(from.to).toBeNull();
    const range = selectDate(from, "2026-10-05");
    expect(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05", "2026-10-06"].map((key) => inSelection(range, key)))
      .toEqual([false, true, true, true, false]);
  });
  it("normalizes reversed date ranges across years", () => {
    expect(selectDate(selectDate(blank, "2027-01-03"), "2026-12-30"))
      .toEqual({ range: true, from: "2026-12-30", to: "2027-01-03" });
  });
  it("allows same-day ranges and starts over on a third click", () => {
    const range = selectDate(selectDate(blank, "2026-10-05"), "2026-10-05");
    expect(range.to).toBe("2026-10-05");
    expect(selectDate(range, "2026-10-09")).toEqual({ range: true, from: "2026-10-09", to: null });
  });
  it("builds only the needed Monday-first weeks including adjacent dates", () => {
    const grid = calendarDays("2026-10-01");
    expect(grid).toHaveLength(35); expect(grid[0]).toBe("2026-09-28"); expect(grid[34]).toBe("2026-11-01");
    expect(calendarDays("2026-08-01")).toHaveLength(42);
  });
  it("handles leap dates and month/year navigation without timezone shifts", () => {
    expect(shiftDate("2028-02-28", 1)).toBe("2028-02-29");
    expect(shiftMonth("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftMonth("2027-01-01", -1)).toBe("2026-12-01");
  });
});
