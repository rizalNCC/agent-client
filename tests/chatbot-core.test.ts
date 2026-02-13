import { describe, expect, it, vi } from "vitest";

import { ChatbotCore } from "../src/index";

describe("ChatbotCore", () => {
  it("adds user and assistant messages via generateResponse", async () => {
    const generateResponse = vi.fn().mockResolvedValue({
      content: "Here is your recommendation summary."
    });

    const bot = new ChatbotCore({ generateResponse });

    const assistant = await bot.sendMessage("recommend leadership course");
    const state = bot.getState();

    expect(assistant?.role).toBe("assistant");
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0].role).toBe("user");
    expect(state.messages[1].role).toBe("assistant");
    expect(generateResponse).toHaveBeenCalledTimes(1);
  });

  it("calls onError when generator fails", async () => {
    const onError = vi.fn();

    const bot = new ChatbotCore({
      generateResponse: vi.fn().mockRejectedValue(new Error("service unavailable")),
      onError
    });

    await expect(bot.sendMessage("hello")).rejects.toThrow("service unavailable");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(bot.getState().isLoading).toBe(false);
  });
});
