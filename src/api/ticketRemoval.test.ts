import type { InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("document", { cookie: "csrftoken=test" });
  vi.stubGlobal("navigator", {});
});
afterEach(() => vi.unstubAllGlobals());

describe("unassigned ticket actions", () => {
  it("serializes multiple ticket types as repeated Django filter keys", async () => {
    const { api } = await import("./client");
    const { ticketApi } = await import("./services");
    let requestUrl = "";
    api.defaults.adapter = async (config) => {
      requestUrl = api.getUri(config);
      return { data: { success: true, data: { count: 0, results: [] } }, status: 200, statusText: "OK", headers: {}, config };
    };
    await ticketApi.list({ company: "company-a", ticket_type: ["BUG", "SERVICE_REQUEST"], needs_review: false });
    const url = new URL(requestUrl, "https://tracker.example");
    expect(url.searchParams.getAll("ticket_type")).toEqual(["BUG", "SERVICE_REQUEST"]);
    expect(url.searchParams.has("ticket_type[]")).toBe(false);
    expect(url.searchParams.get("needs_review")).toBe("false");
    expect(url.searchParams.get("company")).toBe("company-a");
  });
  it.each([
    { disposition: "NOT_A_TICKET" as const },
    { disposition: "DELETE" as const, reason: "Duplicate request" },
  ])("sends the explicit removal payload: $disposition", async (payload) => {
    const { api } = await import("./client");
    const { ticketApi } = await import("./services");
    let captured!: InternalAxiosRequestConfig;
    api.defaults.adapter = async (config) => {
      captured = config;
      return { data: { success: true, data: { disposition: payload.disposition, notification_queued: payload.disposition === "DELETE" } },
        status: 200, statusText: "OK", headers: {}, config };
    };
    const result = await ticketApi.delete("request-id", payload);
    expect(captured.method).toBe("delete");
    expect(captured.url).toBe("/tickets/request-id/");
    expect(JSON.parse(captured.data)).toEqual(payload);
    expect(captured.headers.get("X-CSRFToken")).toBe("test");
    expect(result.notification_queued).toBe(payload.disposition === "DELETE");
  });

  it("loads only requester email attachments", async () => {
    const { api } = await import("./client");
    const { ticketApi } = await import("./services");
    let captured!: InternalAxiosRequestConfig;
    api.defaults.adapter = async (config) => {
      captured = config;
      return { data: { success: true, data: [] }, status: 200, statusText: "OK", headers: {}, config };
    };
    expect(await ticketApi.emailAttachments("request-id")).toEqual([]);
    expect(captured.url).toBe("/tickets/request-id/attachments/");
    expect(captured.params).toEqual({ source: "MAIL" });
  });
});
