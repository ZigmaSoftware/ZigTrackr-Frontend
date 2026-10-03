import { useEffect, useState } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { mergeChatMessages } from "@/lib/ticketChat";
import type { TicketChatMessage } from "@/types";

export function useTicketSocket(path: string | null, queryKey: QueryKey) {
  const queryClient = useQueryClient();
  const [connection, setConnection] = useState<{
    path: string;
    queryKeySignature: string;
    state: "connected" | "disconnected";
  } | null>(null);
  const queryKeySignature = JSON.stringify(queryKey);
  useEffect(() => {
    if (!path) return;
    const socketPath = path;
    const stableQueryKey = JSON.parse(queryKeySignature) as QueryKey;
    let stopped = false;
    let needsCatchUp = false;
    let socket: WebSocket | null = null;
    let retry: number | undefined;

    function connect() {
      const url = new URL(socketPath, window.location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(url);
      socket.onopen = () => {
        if (stopped) return;
        setConnection({ path: socketPath, queryKeySignature, state: "connected" });
        if (needsCatchUp) {
          needsCatchUp = false;
          void queryClient.invalidateQueries({ queryKey: stableQueryKey, exact: true });
        }
      };
      socket.onmessage = (event) => {
        if (stopped) return;
        try {
          const data = JSON.parse(event.data) as { type?: string; message?: TicketChatMessage };
          if (data.type === "message" && data.message?.id && data.message.created_at) {
            queryClient.setQueryData<TicketChatMessage[]>(stableQueryKey, (current) =>
              mergeChatMessages(current, data.message!));
            void queryClient.invalidateQueries({ queryKey: stableQueryKey, exact: true });
          } else if (data.type === "message_changed" || data.type === "receipts_changed") {
            void queryClient.invalidateQueries({ queryKey: stableQueryKey, exact: true });
          }
        } catch {
          // Ignore malformed frames; the next reconnect/fallback fetch restores history.
        }
      };
      socket.onclose = (event) => {
        if (stopped) return;
        setConnection({ path: socketPath, queryKeySignature, state: "disconnected" });
        needsCatchUp = true;
        if (event.code !== 4403) retry = window.setTimeout(connect, 5000);
      };
    }

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retry);
      socket?.close();
    };
  }, [path, queryClient, queryKeySignature]);
  return connection?.path === path && connection.queryKeySignature === queryKeySignature
    ? connection.state : "connecting";
}
