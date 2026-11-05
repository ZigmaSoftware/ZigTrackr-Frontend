import type { FilterState } from "@/hooks/useUrlFilters";

export const ledgerScopes = [
  { key: "all", label: "All tickets" },
  { key: "active", label: "Active" },
  { key: "verify", label: "Verification" },
  { key: "overdue", label: "Overdue" },
  { key: "resolved", label: "Resolved" },
] as const;

export type LedgerScope = typeof ledgerScopes[number]["key"];

export function ledgerScope(value: unknown, presetKey = "all"): LedgerScope {
  /* Closed lists terminal tickets, which the "all" scope filters out; it sits
     on "resolved" instead. Elsewhere "resolved" is a link to /tickets/closed
     rather than a scope, so it folds back to "all". */
  if (presetKey === "closed") return "resolved";
  if (value === "resolved") return "all";
  return ledgerScopes.find((scope) => scope.key === value)?.key ?? "all";
}

export function ledgerParams(
  filters: Partial<FilterState>,
  scope = ledgerScope(filters.scope),
  /* Preset filters that define *which tickets the page is about* — a type, or
     terminal for Closed. These survive the strip below, otherwise Bug Requests
     in ledger layout would quietly list every ticket in the system. */
  presetFilters: Record<string, unknown> = {},
) {
  const params: Record<string, unknown> = { ...filters };
  // The ledger scope owns stage selection; stale preset filters must not
  // contradict the chosen view or narrow summary counts to the current page.
  for (const key of ["scope", "terminal", "assigned", "verification_queue", "overdue", "intake_view", "ticket"]) delete params[key];
  return { ...params, ...presetFilters, submodule: "all", ledger_scope: scope };
}

/* Which stage scopes make sense for a preset. Closed holds only terminal
   tickets, so "active" and "verification" would always be empty there; the
   verification queue is already one stage, so splitting it again says nothing. */
export function scopesForPreset(presetKey: string) {
  if (presetKey === "closed") return [{ key: "resolved" as const, label: "Closed tickets" }];
  if (presetKey === "testing") return ledgerScopes.filter((scope) => ["all", "verify", "overdue"].includes(scope.key));
  if (presetKey === "overdue") return ledgerScopes.filter((scope) => ["all", "active", "verify"].includes(scope.key));
  return ledgerScopes;
}

export function ledgerType(value: string) {
  return ({ BUG: "Bug", SERVICE_REQUEST: "Service", ACCESS_REQUEST: "Access", UNKNOWN: "Unknown" } as Record<string, string>)[value] || value;
}

export function ledgerSource(value: string) {
  return ({ EMAIL: "Email", MANUAL: "Manual", WHATSAPP: "WhatsApp", IN_PERSON: "In person" } as Record<string, string>)[value] || value;
}
