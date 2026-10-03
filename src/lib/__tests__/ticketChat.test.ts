import { describe, expect, it } from "vitest";
import { mergeChatMessages } from "@/lib/ticketChat";
import type { TicketChatMessage } from "@/types";

const message = (id: string, created_at: string): TicketChatMessage => ({
  id,
  created_at,
  delivered_at: null,
  read_at: null,
  is_mine: false,
  sender_type: "STAFF",
  sender_display_name: "Support",
  sender_email: "",
  message_text: id,
  edited_at: null,
  is_deleted: false,
  is_pinned: false,
  is_starred: false,
  can_edit: false,
  reactions: [],
  reply_to: null,
});

describe("mergeChatMessages", () => {
  const first = message("a", "2026-09-29T10:00:00Z");
  const second = message("b", "2026-09-29T10:01:00Z");

  it("adds a broadcast or POST response only once", () => {
    expect(mergeChatMessages([first], second)).toEqual([first, second]);
    expect(mergeChatMessages([first, second], second)).toEqual([first, second]);
  });

  it("keeps a socket message received during a slower history fetch", () => {
    expect(mergeChatMessages([second], [first])).toEqual([first, second]);
  });

  it("preserves server order when timestamps match", () => {
    const sameTime = message("b", first.created_at);
    expect(mergeChatMessages(undefined, [sameTime, first])).toEqual([first, sameTime]);
  });
});
