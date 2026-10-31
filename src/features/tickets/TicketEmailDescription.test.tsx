import { renderToStaticMarkup } from "react-dom/server";
import * as Tooltip from "@radix-ui/react-tooltip";
import { describe, expect, it } from "vitest";
import type { SupportTicketRow } from "@/types";
import { TicketEmailDescription } from "./TicketEmailDescription";

const ticket = { reference: "REF-2610-0042", description: "Cleaned preview." } as SupportTicketRow;
const original = { id: "mail-1", kind: "ORIGINAL" as const, from_name: "Dimple", from_email: "sender@example.com",
  subject: "Login error", received_at: "2026-10-17T09:00:00Z", attachment_count: 0,
  body: "Dear Team,\n\nFull mail text.\n\nRegards,\nDimple\n\nOn Friday, Support wrote:\n> Please retry." };

describe("full intake email description", () => {
  it("shows a clean ledger preview and one zoom button without timestamps or replies", () => {
    const markup = renderToStaticMarkup(<Tooltip.Provider><TicketEmailDescription variant="ledger" ticket={{ ...ticket, description_messages: [original, { ...original, id: "reply-2", kind: "REPLY", body: "Reply text" }] }} /></Tooltip.Provider>);
    expect(markup).toContain('class="ledger-description"');
    expect(markup).toContain("Full mail text.");
    expect(markup).not.toContain("Reply text");
    expect(markup).not.toContain("<time");
    expect(markup.match(/<button/g)).toHaveLength(1);
    expect(markup).toContain("sender@example.com");
    expect(markup).toContain('class="ledger-description-tools"');
    expect(markup.indexOf("sender@example.com")).toBeLessThan(markup.indexOf('class="ledger-description-zoom"'));
    expect(markup.indexOf('class="ledger-description-tools"')).toBeLessThan(markup.indexOf('class="ledger-clamped-text ledger-description-text"'));
  });
  it("retains greetings, signatures, quoted history and line breaks", () => {
    const markup = renderToStaticMarkup(<TicketEmailDescription ticket={{ ...ticket, description_messages: [original] }} />);
    expect(markup).toContain("Dear Team,\n\nFull mail text.");
    expect(markup).toContain("Regards,\nDimple");
    expect(markup).toContain("On Friday, Support wrote:");
    expect(markup).toContain("&gt; Please retry.");
    expect(markup).not.toContain("Cleaned preview.");
    expect(markup).toContain('aria-label="Description for REF-2610-0042"');
    expect(markup).toContain('tabindex="0"');
  });

  it("includes every original/reply body in one scroll region", () => {
    const markup = renderToStaticMarkup(<TicketEmailDescription ticket={{ ...ticket, description_messages: [original,
      { ...original, id: "mail-2", kind: "REPLY", body: "Second complete email.\nRegards,\nMouly" }] }} />);
    expect(markup.match(/class="intake-email"/g)).toHaveLength(2);
    expect(markup).toContain("Second complete email.\nRegards,\nMouly");
    expect(markup.match(/role="region"/g)).toHaveLength(1);
  });

  it("renders untrusted mail as text, never executable markup", () => {
    const markup = renderToStaticMarkup(<TicketEmailDescription ticket={{ ...ticket, description_messages: [
      { ...original, body: '<img src=x onerror="alert(1)"><script>alert(2)</script>' }] }} />);
    expect(markup).not.toContain("<script>");
    expect(markup).not.toContain("<img");
    expect(markup).toContain("&lt;script&gt;");
  });

  it("keeps complete manual descriptions as a fallback", () => {
    const markup = renderToStaticMarkup(<TicketEmailDescription ticket={{ ...ticket, description: "Hello,\nManual request.\nRegards,\nDimple" }} />);
    expect(markup).toContain("Hello,\nManual request.\nRegards,\nDimple");
  });
});
