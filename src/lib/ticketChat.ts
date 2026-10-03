import type { TicketChatMessage } from "@/types";

export function mergeChatMessages(
  current: TicketChatMessage[] | undefined,
  incoming: TicketChatMessage | TicketChatMessage[],
): TicketChatMessage[] {
  const messages = new Map((current ?? []).map((message) => [message.id, message]));
  for (const message of Array.isArray(incoming) ? incoming : [incoming]) {
    messages.set(message.id, message);
  }
  return [...messages.values()].sort((a, b) =>
    a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}
