import { describe, expect, it, vi } from "vitest";

import {
  AiAgentApiError,
  AiAgentClientError,
  createAiAgentClient,
  type HealthResponse,
  type RespondResponse
} from "../src/index";

function buildJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("AiAgentClient", () => {
  it("sends respond payload and returns typed response", async () => {
    const mockResponse: RespondResponse = {
      session_id: 1,
      user_message_id: 10,
      assistant_message_id: 11,
      message: "Hello",
      model: "gpt-4o-mini",
      response_id: "resp_1",
      prompt: { version: "v1", hash: "abc" }
    };

    const fetchImpl = vi.fn().mockResolvedValue(buildJsonResponse(mockResponse));

    const client = createAiAgentClient({
      baseUrl: "https://api.example.com/api/v2",
      getAccessToken: "token_123",
      fetchImpl
    });

    const response = await client.respond({
      agent: "home-assistant",
      message: "rekomendasi",
      metadata: { course_id: 28 }
    });

    expect(response).toEqual(mockResponse);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.example.com/api/v2/ai-agent/respond/");
    expect(init.method).toBe("POST");
    expect(init.headers.get("Authorization")).toBe("Bearer token_123");

    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      agent: "home-assistant",
      message: "rekomendasi",
      metadata: { course_id: 28 }
    });
  });

  it("throws AiAgentApiError when API returns non-2xx", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(buildJsonResponse({ detail: "bad" }, 400));

    const client = createAiAgentClient({
      baseUrl: "https://api.example.com/api/v2",
      fetchImpl
    });

    await expect(
      client.respond({ message: "hello" })
    ).rejects.toBeInstanceOf(AiAgentApiError);
  });

  it("exposes error body in AiAgentApiError", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(buildJsonResponse({ detail: "bad payload" }, 422));

    const client = createAiAgentClient({
      baseUrl: "https://api.example.com/api/v2",
      fetchImpl
    });

    await expect(client.respond({ message: "hello" })).rejects.toMatchObject({
      status: 422,
      body: { detail: "bad payload" },
      data: { detail: "bad payload" },
      code: "http_error"
    });
  });

  it("retries GET requests on transient status by default", async () => {
    const healthy: HealthResponse = {
      ok: true,
      checked: true,
      model: "gpt-4o-mini",
      prompt: { version: "v1", hash: "abc" },
      feature_enabled: true
    };

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(buildJsonResponse({ detail: "unavailable" }, 503))
      .mockResolvedValueOnce(buildJsonResponse(healthy, 200));

    const client = createAiAgentClient({
      baseUrl: "https://api.example.com/api/v2",
      fetchImpl,
      retry: { backoffMs: 0, maxBackoffMs: 0 }
    });

    const result = await client.health();
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry POST requests unless explicitly configured", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(buildJsonResponse({ detail: "unavailable" }, 503))
      .mockResolvedValueOnce(
        buildJsonResponse({
          session_id: 1,
          user_message_id: 10,
          assistant_message_id: 11,
          message: "ok",
          model: "gpt-4o-mini",
          response_id: "resp_1",
          prompt: { version: "v1", hash: "abc" }
        } satisfies RespondResponse)
      );

    const client = createAiAgentClient({
      baseUrl: "https://api.example.com/api/v2",
      fetchImpl
    });

    await expect(client.respond({ message: "hello" })).rejects.toBeInstanceOf(
      AiAgentApiError
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries POST request when retry override is provided", async () => {
    const okResponse: RespondResponse = {
      session_id: 1,
      user_message_id: 10,
      assistant_message_id: 11,
      message: "ok",
      model: "gpt-4o-mini",
      response_id: "resp_1",
      prompt: { version: "v1", hash: "abc" }
    };

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(buildJsonResponse({ detail: "unavailable" }, 503))
      .mockResolvedValueOnce(buildJsonResponse(okResponse, 200));

    const client = createAiAgentClient({
      baseUrl: "https://api.example.com/api/v2",
      fetchImpl
    });

    const result = await client.respond(
      { message: "hello" },
      { retry: { retries: 1, backoffMs: 0, maxBackoffMs: 0 } }
    );

    expect(result.message).toBe("ok");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retries network errors when enabled", async () => {
    const healthy: HealthResponse = {
      ok: true,
      checked: true,
      model: "gpt-4o-mini",
      prompt: { version: "v1", hash: "abc" },
      feature_enabled: true
    };

    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(buildJsonResponse(healthy, 200));

    const client = createAiAgentClient({
      baseUrl: "https://api.example.com/api/v2",
      fetchImpl,
      retry: { retries: 1, backoffMs: 0, maxBackoffMs: 0 }
    });

    const result = await client.health();
    expect(result.checked).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws typed client error for network failures when retry is disabled", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    const client = createAiAgentClient({
      baseUrl: "https://api.example.com/api/v2",
      fetchImpl
    });

    await expect(client.health({ retry: false })).rejects.toMatchObject({
      name: "AiAgentClientError",
      code: "network_error"
    } satisfies Partial<AiAgentClientError>);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
