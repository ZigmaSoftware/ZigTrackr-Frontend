import type { FilterState } from "@/hooks/useUrlFilters";

export const ledgerScopes = [
  { key: "all", label: "All tickets" },
  { key: "active", label: "Active" },
  { key: "verify", label: "Verification" },
  { key: "overdue", label: "Overdue" },
  { key: "resolved", label: "Resolved" },
] as const;

export type LedgerScope = typeof ledgerScopes[number]["key"];

export function ledgerScope(value: unknown): LedgerScope {
  if (value === "resolved") return "all";
  return ledgerScopes.find((scope) => scope.key === value)?.key ?? "all";
}

export function ledgerParams(filters: Partial<FilterState>, scope = ledgerScope(filters.scope)) {
  const params: Record<string, unknown> = { ...filters };
  // The ledger scope owns stage selection; stale preset filters must not
  // contradict the chosen view or narrow summary counts to the current page.
  for (const key of ["scope", "terminal", "assigned", "verification_queue", "overdue", "intake_view", "ticket"]) delete params[key];
  return { ...params, submodule: "all", ledger_scope: scope };
}

export function ledgerType(value: string) {
  return ({ BUG: "Bug", SERVICE_REQUEST: "Service", ACCESS_REQUEST: "Access", UNKNOWN: "Unknown" } as Record<string, string>)[value] || value;
}

export function ledgerSource(value: string) {
  return ({ EMAIL: "Email", MANUAL: "Manual", WHATSAPP: "WhatsApp", IN_PERSON: "In person" } as Record<string, string>)[value] || value;
}
