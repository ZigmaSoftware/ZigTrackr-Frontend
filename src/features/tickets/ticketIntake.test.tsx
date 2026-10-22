import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SupportTicketRow } from "@/types";
import { intakeParams, intakeQueueLabel, intakeView } from "./ticketIntake";
import { IntakeReceived, IntakeSender, IntakeSource, IntakeType } from "./TicketIntakeCells";

describe("T01 intake views", () => {
  it("uses valid URL views and falls back to all", () => {
    expect(intakeView("ready")).toBe("ready");
    expect(intakeView("invalid")).toBe("all");
  });
  it("keeps company, source, search and pagination on every server query", () => {
    expect(intakeParams({ company: "company-a", source: "EMAIL", search: "login", page: 2, limit: 6, intake_view: "all" }, "all"))
      .toEqual({ company: "company-a", source: "EMAIL", search: "login", page: 2, limit: 6, unassigned: true, terminal: false, submodule: "unassigned" });
  });
  it("uses server filters, not a filter of the current six rows", () => {
    expect(intakeParams({}, "classify").ticket_type).toBe("UNKNOWN");
    expect(intakeParams({}, "ready")).toMatchObject({ ticket_type: ["BUG", "SERVICE_REQUEST", "ACCESS_REQUEST"], needs_review: false });
    expect(intakeParams({}, "review")).toMatchObject({ ticket_type: ["BUG", "SERVICE_REQUEST", "ACCESS_REQUEST"], needs_review: true });
    expect(intakeParams({ ticket_type: "BUG" }, "ready").ticket_type).toEqual(["BUG"]);
  });
  it("labels each queue consistently with its filters", () => {
    expect(intakeQueueLabel({ ticket_type: "UNKNOWN", needs_review: true })).toBe("Unclassified");
    expect(intakeQueueLabel({ ticket_type: "BUG", needs_review: true })).toBe("Needs a closer look");
    expect(intakeQueueLabel({ ticket_type: "BUG", needs_review: false })).toBe("Ready to assign");
  });
  it("omits blank filters without dropping false boolean filters", () => {
    expect(intakeParams({ ticket_type: "", needs_review: undefined, company: "", terminal: false }, "all"))
      .toEqual({ terminal: false, unassigned: true, submodule: "unassigned" });
  });
});

describe("T01 table presentation", () => {
  it("uses the prototype labels instead of uppercase internal type codes", () => {
    expect(renderToStaticMarkup(<IntakeType type="UNKNOWN" />)).toContain("Unclassified");
    expect(renderToStaticMarkup(<IntakeType type="SERVICE_REQUEST" />)).toContain("Service");
    expect(renderToStaticMarkup(<IntakeSource source="EMAIL" />)).toContain("Email");
  });
  it("renders sender content as text and preserves the full title", () => {
    const markup = renderToStaticMarkup(<IntakeSender ticket={{ reported_by_name: "<script>sender</script>", reported_by_email: "long-address@example.com" } as SupportTicketRow} />);
    expect(markup).not.toContain("<script>");
    expect(markup).toContain("long-address@example.com");
    expect(markup).toContain("&lt;script&gt;");
  });
  it("distinguishes manual creation from a received email", () => {
    const ticket = { created_at: "2026-10-17T09:00:00Z", mail_received_at: null } as SupportTicketRow;
    expect(renderToStaticMarkup(<IntakeReceived ticket={ticket} />)).toContain("logged");
    expect(renderToStaticMarkup(<IntakeReceived ticket={{ ...ticket, mail_received_at: ticket.created_at }} />)).not.toContain("logged");
  });
});
