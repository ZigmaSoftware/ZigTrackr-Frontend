import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Clock3 } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "@/api/services";
import { Button } from "@/components/ui/primitives";
import type { SessionUser } from "@/types";
import { SessionMonitor } from "./sessionMonitor";

export function SessionTimeout({ user, logout }: { user: SessionUser; logout: () => Promise<void> }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const monitor = useRef<SessionMonitor | null>(null);

  useEffect(() => {
    if (!user.session) return;
    const channel = typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel("zigtrackr-session-activity") : null;
    const tracker = new SessionMonitor(user.session, {
      activity: authApi.activity,
      warning: setRemaining,
      expired: () => {
        toast.info("Your session expired. Please sign in again.");
        void logout();
      },
      renewed: (policy) => channel?.postMessage({ userId: user.id, policy }),
    });
    monitor.current = tracker;
    if (channel) channel.onmessage = ({ data }) => {
      if (data?.userId === user.id && data.policy) tracker.update(data.policy);
    };
    const activity = () => { void tracker.activity(); };
    const check = () => tracker.tick();
    const events = ["pointerdown", "keydown", "scroll"] as const;
    events.forEach((event) => window.addEventListener(event, activity, { passive: true }));
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    const interval = window.setInterval(check, 1_000);
    tracker.tick();
    return () => {
      tracker.stop();
      channel?.close();
      window.clearInterval(interval);
      events.forEach((event) => window.removeEventListener(event, activity));
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      monitor.current = null;
    };
  }, [user.id, user.session, logout]);

  return (
    <Dialog.Root open={remaining !== null}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[91] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <Clock3 className="mb-3 size-7 text-[var(--primary)]" aria-hidden />
          <Dialog.Title className="text-lg font-semibold">Your session is ending</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-[var(--muted-foreground)]">
            You’ll be signed out in {remaining ?? 0} seconds. Continue working to stay signed in.
            Sessions cannot extend beyond the maximum login period.
          </Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => void logout()}>Sign out</Button>
            <Button onClick={() => void monitor.current?.activity(true)}>Stay signed in</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
