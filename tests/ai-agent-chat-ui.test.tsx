/* @vitest-environment jsdom */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AiAgentChat } from "../src/adapters/react";
import type { GenerateResponseResult, RecommendationItem } from "../src/core/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function recommendation(id: number, title: string): RecommendationItem {
  return {
    id,
    title,
    description: `${title} description`,
    url: `https://example.com/courses/${id}`,
    type: "Course",
    status: null,
    progress: 0,
    is_eligible: true,
    in_playlist: false
  };
}

describe("AiAgentChat UI", () => {
  it("shows typing indicator while generating and hides it after response", async () => {
    const pending = deferred<GenerateResponseResult>();
    const generateResponse = vi.fn().mockReturnValue(pending.promise);
    const { container } = render(<AiAgentChat generateResponse={generateResponse} />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText("Ask the assistant..."), "hello");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(container.querySelector(".ai-agent-chat__message--typing")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();

    pending.resolve({ content: "Hello from assistant." });

    await waitFor(() => {
      expect(container.querySelector(".ai-agent-chat__message--typing")).toBeNull();
    });
    expect(screen.getByText("Hello from assistant.")).toBeTruthy();
  });

  it("stops in-flight generation when stop action is clicked", async () => {
    const generateResponse = vi.fn(({ signal }) => {
      return new Promise<GenerateResponseResult>((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        void resolve;
      });
    });
    const { container } = render(<AiAgentChat generateResponse={generateResponse} />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText("Ask the assistant..."), "stop test");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.click(screen.getByRole("button", { name: "Stop" }));

    await waitFor(() => {
      expect(container.querySelector(".ai-agent-chat__message--typing")).toBeNull();
    });
    expect(screen.queryByText("aborted")).toBeNull();
  });

  it("renders error message when generation fails", async () => {
    const generateResponse = vi.fn().mockRejectedValue(new Error("service unavailable"));
    render(<AiAgentChat generateResponse={generateResponse} />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText("Ask the assistant..."), "hello");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("service unavailable")).toBeTruthy();
  });

  it("loads and appends more recommendation items", async () => {
    const generateResponse = vi.fn().mockResolvedValue({
      content: "Here are recommendations.",
      recommendations: [recommendation(1, "Leadership Basics")],
      recommendationNext: "/next-page"
    });

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        next: null,
        results: [recommendation(2, "Advanced Communication")]
      })
    } as Response);
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <AiAgentChat
        generateResponse={generateResponse}
        baseURL="https://api.example.com/api"
        accessToken="token"
      />
    );
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText("Ask the assistant..."), "recommend course");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Leadership Basics")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByText("Advanced Communication")).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
