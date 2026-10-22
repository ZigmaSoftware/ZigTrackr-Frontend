import type { SupportTicketRow } from "@/types";

export const intakeViews = [
  { key: "all", label: "All requests" },
  { key: "classify", label: "Unclassified" },
  { key: "ready", label: "Ready to assign" },
  { key: "review", label: "Review" },
] as const;
export type IntakeView = typeof intakeViews[number]["key"];
const knownTypes = ["BUG", "SERVICE_REQUEST", "ACCESS_REQUEST"];

export function intakeView(value: unknown): IntakeView {
  return intakeViews.some((view) => view.key === value) ? value as IntakeView : "all";
}

export function intakeParams(filters: Record<string, unknown>, view: IntakeView): Record<string, unknown> {
  const params = { ...filters };
  delete params.intake_view;
  for (const key of Object.keys(params)) {
    if (params[key] === "" || params[key] === undefined || params[key] === null) delete params[key];
  }
  // A known type awaiting review is separate from an unclassified request.
  if (view === "classify") params.ticket_type = "UNKNOWN";
  if (view === "ready" || view === "review") {
    const requested = Array.isArray(params.ticket_type) ? params.ticket_type : params.ticket_type ? [params.ticket_type] : knownTypes;
    const selected = requested.filter((type) => knownTypes.includes(String(type)));
    params.ticket_type = selected.length ? selected : knownTypes;
    params.needs_review = view === "review";
  }
  return { ...params, unassigned: true, terminal: false, submodule: "unassigned" };
}

export function intakeQueueLabel(ticket: Pick<SupportTicketRow, "ticket_type" | "needs_review">) {
  return ticket.ticket_type === "UNKNOWN" ? "Unclassified" : ticket.needs_review ? "Needs a closer look" : "Ready to assign";
}
