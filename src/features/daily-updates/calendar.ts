export interface DateSelection { range: boolean; from: string | null; to: string | null }

export function dateKey(date: Date): string { return date.toISOString().slice(0, 10); }
export function asDate(key: string): Date { return new Date(`${key}T12:00:00Z`); }
export function shiftDate(key: string, days: number): string {
  const date = asDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}
export function monthKey(key: string): string { return `${key.slice(0, 7)}-01`; }
export function shiftMonth(key: string, amount: number): string {
  const date = asDate(monthKey(key));
  date.setUTCMonth(date.getUTCMonth() + amount);
  return dateKey(date);
}
export function calendarDays(month: string): string[] {
  const first = asDate(monthKey(month));
  const offset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => shiftDate(dateKey(first), index - offset));
}
export function selectDate(selection: DateSelection, key: string): DateSelection {
  if (!selection.range) return { range: false, from: key, to: key };
  if (!selection.from || selection.to) return { range: true, from: key, to: null };
  return { range: true, from: key < selection.from ? key : selection.from, to: key < selection.from ? selection.from : key };
}
export function inSelection(selection: DateSelection, key: string): boolean {
  return Boolean(selection.from && key >= selection.from && key <= (selection.to ?? selection.from));
}
export function formatDay(key: string, options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }): string {
  return asDate(key).toLocaleDateString("en-GB", { ...options, timeZone: "UTC" });
}
export function todayKey(timeZone = "Asia/Kolkata"): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
