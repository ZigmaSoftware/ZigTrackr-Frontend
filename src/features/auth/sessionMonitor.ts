import type { SessionPolicy } from "@/types";

interface MonitorCallbacks {
  activity: () => Promise<SessionPolicy>;
  warning: (remainingSeconds: number | null) => void;
  expired: () => void;
  renewed: (policy: SessionPolicy) => void;
}

/** Background API traffic is deliberately NOT a call to activity(). */
export class SessionMonitor {
  private policy: SessionPolicy;
  private offset: number;
  private lastSent = -Infinity;
  private pending = false;
  private ended = false;
  private callbacks: MonitorCallbacks;

  constructor(
    policy: SessionPolicy,
    callbacks: MonitorCallbacks,
  ) {
    this.policy = policy;
    this.callbacks = callbacks;
    this.offset = policy.server_time * 1_000 - Date.now();
  }

  update(policy: SessionPolicy) {
    this.policy = policy;
    this.offset = policy.server_time * 1_000 - Date.now();
    this.tick();
  }

  tick() {
    if (this.ended) return;
    const remaining = Math.ceil((Math.min(this.policy.idle_expires_at, this.policy.absolute_expires_at)
      * 1_000 - Date.now() - this.offset) / 1_000);
    if (remaining <= 0) {
      this.ended = true;
      this.callbacks.expired();
    } else {
      this.callbacks.warning(remaining <= this.policy.warning_seconds ? remaining : null);
    }
  }

  async activity(force = false) {
    this.tick(); // An event after sleep/expiry must not revive the session.
    if (this.ended || this.pending || (!force && Date.now() - this.lastSent < 60_000)) return;
    this.pending = true;
    this.lastSent = Date.now();
    try {
      const policy = await this.callbacks.activity();
      if (!this.ended) {
        this.update(policy);
        this.callbacks.renewed(policy);
      }
    } catch {
      // Failed requests never extend the deadline; retry on later activity.
      this.lastSent = Date.now() - 50_000;
    } finally {
      this.pending = false;
    }
  }

  stop() { this.ended = true; }
}
