import { differenceInCalendarDays, format, formatDistanceToNow, isToday, parseISO } from "date-fns";

/** Spec 58: one display format across the whole application. */
export function formatDate(value?: string | null): string {
  if (!value) return "—";
  try {
    return format(parseISO(value), "dd MMM yyyy");
  } catch {
    return "—";
  }
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  try {
    return format(parseISO(value), "dd MMM yyyy, hh:mm a");
  } catch {
    return "—";
  }
}

export function formatTime(value?: string | null): string {
  if (!value) return "";
  try {
    return format(parseISO(value), "hh:mm a");
  } catch {
    return "";
  }
}

export function relativeTime(value?: string | null): string {
  if (!value) return "Never";
  try {
    const date = parseISO(value);
    if (isToday(date)) return "Today";
    return `${formatDistanceToNow(date)} ago`;
  } catch {
    return "—";
  }
}

export function daysSince(value?: string | null): number | null {
  if (!value) return null;
  try {
    return differenceInCalendarDays(new Date(), parseISO(value));
  } catch {
    return null;
  }
}

/** ISO date for an <input type="date"> */
export function toDateInput(value?: string | null): string {
  if (!value) return "";
  try {
    return format(parseISO(value), "yyyy-MM-dd");
  } catch {
    return "";
  }
}

export function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export function longDate(date = new Date()): string {
  return format(date, "EEEE, d MMMM yyyy");
}
