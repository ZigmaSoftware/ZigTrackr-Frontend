import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, {
    data: {}, status: 401, statusText: "Unauthorized", headers: {}, config,
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("document", { cookie: "csrftoken=test" });
  vi.stubGlobal("navigator", {});
});
afterEach(() => vi.unstubAllGlobals());

describe("session refresh races", () => {
  it("shares a browser-wide lock for login, refresh and logout operations", async () => {
    const request = vi.fn(async (_name: string, operation: () => Promise<string>) => operation());
    vi.stubGlobal("navigator", { locks: { request } });
    const { withAuthSessionLock } = await import("./client");
    expect(await withAuthSessionLock(async () => "completed")).toBe("completed");
    expect(request).toHaveBeenCalledWith("zigtrackr-auth-session", expect.any(Function));
  });

  it("single-flights concurrent 401 responses", async () => {
    const { api } = await import("./client");
    let refreshes = 0;
    api.defaults.adapter = async (config) => {
      if (config.url === "/auth/refresh/") {
        refreshes += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
      } else if (!(config as InternalAxiosRequestConfig & { _retried?: boolean })._retried) {
        throw unauthorized(config);
      }
      return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    };
    const responses = await Promise.all([api.get("/auth/me/"), api.get("/tickets/")]);
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(refreshes).toBe(1);
  });

  it("does not attempt refresh after manual sign-out", async () => {
    const { api, blockSessionRefresh, setSessionLostHandler } = await import("./client");
    const lost = vi.fn();
    setSessionLostHandler(lost);
    blockSessionRefresh();
    const paths: string[] = [];
    api.defaults.adapter = async (config) => { paths.push(config.url ?? ""); throw unauthorized(config); };
    await expect(api.get("/tickets/")).rejects.toBeInstanceOf(AxiosError);
    expect(paths).toEqual(["/tickets/"]);
    expect(lost).not.toHaveBeenCalled();
  });

  it("ignores an old account's delayed 401 after a new login", async () => {
    const { api, allowSessionRequests, setSessionLostHandler } = await import("./client");
    const lost = vi.fn();
    setSessionLostHandler(lost);
    let rejectRequest!: () => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    api.defaults.adapter = (config) => new Promise((_, reject) => {
      rejectRequest = () => reject(unauthorized(config));
      started();
    });
    const request = api.get("/tickets/");
    const rejected = expect(request).rejects.toBeInstanceOf(AxiosError);
    await ready;
    allowSessionRequests();
    rejectRequest();
    await rejected;
    expect(lost).not.toHaveBeenCalled();
  });

  it("does not resurrect or end a newer session when an old refresh finishes", async () => {
    const { api, blockSessionRefresh, allowSessionRequests, setSessionLostHandler } = await import("./client");
    const lost = vi.fn();
    setSessionLostHandler(lost);
    let finish!: () => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    let ticketRequests = 0;
    api.defaults.adapter = async (config) => {
      if (config.url === "/auth/refresh/") {
        started();
        await new Promise<void>((resolve) => { finish = resolve; });
        return { data: {}, status: 200, statusText: "OK", headers: {}, config };
      }
      ticketRequests += 1;
      throw unauthorized(config);
    };
    const request = api.get("/tickets/");
    const rejected = expect(request).rejects.toBeInstanceOf(AxiosError);
    await ready;
    blockSessionRefresh(); allowSessionRequests();
    finish();
    await rejected;
    expect(ticketRequests).toBe(1);
    expect(lost).not.toHaveBeenCalled();
  });

  it("notifies the UI when the current session refresh fails", async () => {
    const { api, setSessionLostHandler } = await import("./client");
    const lost = vi.fn();
    setSessionLostHandler(lost);
    api.defaults.adapter = async (config) => { throw unauthorized(config); };
    await expect(api.get("/tickets/")).rejects.toBeInstanceOf(AxiosError);
    expect(lost).toHaveBeenCalledOnce();
  });
});
