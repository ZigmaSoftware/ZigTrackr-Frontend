import type { InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("document", { cookie: "csrftoken=test" });
  vi.stubGlobal("navigator", {});
});
afterEach(() => vi.unstubAllGlobals());

describe("company administration scope", () => {
  it.each([undefined, "company-a"])("preserves scope %s across reads and writes", async (company) => {
    const { api } = await import("./client");
    const { roleApi } = await import("./services");
    const requests: InternalAxiosRequestConfig[] = [];
    api.defaults.adapter = async (config) => {
      requests.push(config);
      return { data: { success: true, data: {} }, status: 200, statusText: "OK", headers: {}, config };
    };
    const changes = [{ key: "administration.user", enabled: false }];

    await roleApi.list(company);
    await roleApi.matrix(company);
    await roleApi.update("developer", { name: "Engineer" }, company);
    await roleApi.updateSubmodulePermissions("developer", changes, company);

    const scope = company ? { company } : undefined;
    expect(requests[0].url).toBe("/roles/");
    expect(requests[0].params).toEqual(scope);
    expect(requests[1].url).toBe("/permissions/matrix/");
    expect(requests[1].params).toEqual(scope);
    expect(requests[2].url).toBe(`/roles/developer/${company ? "?company=company-a" : ""}`);
    expect(JSON.parse(requests[2].data)).toEqual({ name: "Engineer" });
    expect(requests[3].url).toBe("/roles/developer/permissions/");
    expect(requests[3].params).toEqual(scope);
    expect(JSON.parse(requests[3].data)).toEqual({ submodule_changes: changes });
    expect(requests[3].headers.get("X-CSRFToken")).toBe("test");
  });
});
