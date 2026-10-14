import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionPolicy } from "@/types";
import { SessionMonitor } from "./sessionMonitor";

const start = 1_800_000_000;
const policy: SessionPolicy = {
  idle_timeout_seconds: 1800, warning_seconds: 60,
  server_time: start, idle_expires_at: start + 1800, absolute_expires_at: start + 28800,
};

function setup(initial = policy) {
  const callbacks = {
    activity: vi.fn(async () => ({ ...initial, server_time: start + 100, idle_expires_at: start + 1900 })),
    warning: vi.fn(), expired: vi.fn(), renewed: vi.fn(),
  };
  return { callbacks, monitor: new SessionMonitor(initial, callbacks) };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(start * 1000); });
afterEach(() => vi.useRealTimers());

describe("staff session inactivity", () => {
  it("warns one minute before expiry and expires only once", () => {
    const { monitor, callbacks } = setup();
    vi.setSystemTime((start + 1740) * 1000);
    monitor.tick();
    expect(callbacks.warning).toHaveBeenLastCalledWith(60);
    vi.setSystemTime((start + 1800) * 1000);
    monitor.tick(); monitor.tick();
    expect(callbacks.expired).toHaveBeenCalledTimes(1);
    expect(callbacks.activity).not.toHaveBeenCalled();
  });

  it("limits user activity requests to one per minute", async () => {
    const { monitor, callbacks } = setup();
    await monitor.activity(); await monitor.activity();
    expect(callbacks.activity).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    await monitor.activity();
    expect(callbacks.activity).toHaveBeenCalledTimes(2);
  });

  it("allows Stay signed in to bypass the activity throttle", async () => {
    const { monitor, callbacks } = setup();
    await monitor.activity(); await monitor.activity(true);
    expect(callbacks.activity).toHaveBeenCalledTimes(2);
    expect(callbacks.renewed).toHaveBeenCalledTimes(2);
  });

  it("does not revive an idle session after browser sleep", async () => {
    const { monitor, callbacks } = setup();
    vi.setSystemTime((start + 1801) * 1000);
    await monitor.activity(true);
    expect(callbacks.expired).toHaveBeenCalledOnce();
    expect(callbacks.activity).not.toHaveBeenCalled();
  });

  it("honors the absolute limit even if idle expiry is later", () => {
    const { monitor, callbacks } = setup({ ...policy, absolute_expires_at: start + 100 });
    vi.setSystemTime((start + 100) * 1000);
    monitor.tick();
    expect(callbacks.expired).toHaveBeenCalledOnce();
  });

  it("does not extend deadlines when the activity request fails", async () => {
    const { monitor, callbacks } = setup();
    callbacks.activity.mockRejectedValueOnce(new Error("offline"));
    await monitor.activity();
    vi.setSystemTime((start + 1800) * 1000);
    monitor.tick();
    expect(callbacks.expired).toHaveBeenCalledOnce();
    expect(callbacks.renewed).not.toHaveBeenCalled();
  });

  it("accepts another tab's activity and accounts for local clock skew", () => {
    vi.setSystemTime((start + 10000) * 1000);
    const { monitor, callbacks } = setup();
    monitor.tick();
    expect(callbacks.warning).toHaveBeenLastCalledWith(null);
    monitor.update({ ...policy, server_time: start + 10, idle_expires_at: start + 1810 });
    vi.advanceTimersByTime(1_800_000);
    monitor.tick();
    expect(callbacks.expired).toHaveBeenCalledOnce();
  });

  it("ignores late activity responses after unmount/logout", async () => {
    const { monitor, callbacks } = setup();
    const pending = monitor.activity();
    monitor.stop();
    await pending;
    expect(callbacks.renewed).not.toHaveBeenCalled();
  });
});
