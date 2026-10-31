import { describe, expect, it } from "vitest";
import { ledgerParams, ledgerScope } from "./ticketLedger";

describe("Work Ledger queries", () => {
  it("uses validated scopes and falls back on invalid URLs", () => {
    expect(ledgerScope("verify")).toBe("verify");
    expect(ledgerScope("invalid")).toBe("all");
    expect(ledgerScope("resolved")).toBe("all");
  });
  it("does not restore closed records through a stale resolved URL", () => {
    expect(ledgerParams({ scope: "resolved", terminal: false, verification_queue: true, assigned: true, company: "company-a", page: 2, limit: 8 }))
      .toEqual({ submodule: "all", ledger_scope: "all", company: "company-a", page: 2, limit: 8 });
  });
  it("uses the same server query for counts and results while retaining search and owner", () => {
    expect(ledgerParams({ scope: "active", owner: "owner-a", search: "login", status: "", page: 1, limit: 1 }, "verify"))
      .toMatchObject({ ledger_scope: "verify", owner: "owner-a", search: "login", page: 1, limit: 1 });
  });
});
