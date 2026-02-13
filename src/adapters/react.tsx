import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChatbotCore } from "../core/chatbot";
import { extractRecommendationItems } from "../lib/tool-results";
import type {
  AgentMetadata,
  ChatMessage,
  ChatbotCoreConfig,
  ChatbotState,
  GenerateResponse,
  RespondResponse
} from "../core/types";

const EMPTY_METADATA: AgentMetadata = {};

export interface UseAiAgentChatResult extends ChatbotState {
  sendMessage: (text: string) => Promise<ChatMessage | undefined>;
  stop: () => void;
}

export function useAiAgentChat(config: ChatbotCoreConfig): UseAiAgentChatResult {
  const coreRef = useRef<ChatbotCore | null>(null);
  const [state, setState] = useState<ChatbotState>({
    messages: config.initialMessages || [],
    isLoading: false
  });

  useEffect(() => {
    const core = new ChatbotCore(config);
    coreRef.current = core;

    const unsubscribe = core.subscribe((nextState) => {
      setState(nextState);
    });

    return () => {
      unsubscribe();
      core.destroy();
      coreRef.current = null;
    };
  }, [config]);

  const sendMessage = useCallback(async (text: string) => {
    if (!coreRef.current) {
      return undefined;
    }
    return coreRef.current.sendMessage(text);
  }, []);

  const stop = useCallback(() => {
    if (!coreRef.current) {
      return;
    }
    coreRef.current.stop();
  }, []);

  return {
    ...state,
    sendMessage,
    stop
  };
}

export interface AiAgentChatProps {
  generateResponse?: GenerateResponse;
  initialMessages?: ChatMessage[];
  onMessage?: ChatbotCoreConfig["onMessage"];
  onError?: ChatbotCoreConfig["onError"];
  baseURL?: string;
  accessToken?: string | (() => string | undefined | Promise<string | undefined>);
  agent?: string;
  metadata?: AgentMetadata;
  requestHeaders?: HeadersInit;
  respondPath?: string;
  className?: string;
  placeholder?: string;
  sendLabel?: string;
  stopLabel?: string;
}

async function resolveAccessToken(
  provider: AiAgentChatProps["accessToken"]
): Promise<string | undefined> {
  if (!provider) {
    return undefined;
  }
  if (typeof provider === "string") {
    return provider.trim() || undefined;
  }
  const token = await provider();
  return typeof token === "string" ? token.trim() || undefined : undefined;
}

function normalizeBaseURL(baseURL: string): string {
  return baseURL.replace(/\/+$/, "");
}

function resolveRespondPath(baseURL: string, overridePath?: string): string {
  if (overridePath && overridePath.trim()) {
    return normalizePath(overridePath.trim());
  }

  const normalizedBase = normalizeBaseURL(baseURL);
  if (normalizedBase.endsWith("/api")) {
    return "/v2/ai-agent/respond/";
  }

  return "/api/v2/ai-agent/respond/";
}

function normalizePath(path: string): string {
  if (!path) {
    return "/api/v2/ai-agent/respond/";
  }
  if (path.startsWith("/")) {
    return path;
  }
  return `/${path}`;
}

export function AiAgentChat({
  generateResponse,
  baseURL,
  accessToken,
  agent = "home-assistant",
  metadata,
  requestHeaders,
  respondPath = "/api/v2/ai-agent/respond/",
  initialMessages,
  onMessage,
  onError,
  className = "",
  placeholder = "Ask the assistant...",
  sendLabel = "Send",
  stopLabel = "Stop"
}: AiAgentChatProps) {
  const [input, setInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const resolvedMetadata = useMemo(() => metadata || EMPTY_METADATA, [metadata]);

  const transport = useCallback<GenerateResponse>(
    async ({ messages, signal }) => {
      if (typeof generateResponse === "function") {
        return generateResponse({ messages, signal });
      }

      if (!baseURL || !baseURL.trim()) {
        throw new Error("AiAgentChat requires `baseURL` when `generateResponse` is not provided.");
      }

      const token = await resolveAccessToken(accessToken);
      if (!token) {
        throw new Error(
          "AiAgentChat requires `accessToken` when `generateResponse` is not provided."
        );
      }

      const headers = new Headers(requestHeaders);
      headers.set("content-type", "application/json");
      headers.set("authorization", `Bearer ${token}`);

      const latestUser = [...messages].reverse().find((item) => item.role === "user");
      const userMessage = latestUser?.content || "";
      const resolvedPath = resolveRespondPath(baseURL, respondPath);
      const response = await fetch(`${normalizeBaseURL(baseURL)}${resolvedPath}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          agent,
          message: userMessage,
          metadata: resolvedMetadata
        }),
        signal
      });

      const raw = (await response.json()) as RespondResponse | { detail?: string; message?: string };
      if (!response.ok) {
        const detail =
          typeof raw === "object" && raw
            ? "detail" in raw && typeof raw.detail === "string"
              ? raw.detail
              : "message" in raw && typeof raw.message === "string"
                ? raw.message
                : ""
            : "";
        throw new Error(`AI Agent request failed (${response.status})${detail ? `: ${detail}` : ""}`);
      }

      const backendResponse = raw as RespondResponse;
      return {
        content: backendResponse.message,
        toolResults: backendResponse.tool_results,
        recommendations: extractRecommendationItems(backendResponse)
      };
    },
    [accessToken, agent, baseURL, generateResponse, requestHeaders, respondPath, resolvedMetadata]
  );

  const stableConfig = useMemo<ChatbotCoreConfig>(
    () => ({
      generateResponse: transport,
      initialMessages,
      onMessage,
      onError: (error, messages) => {
        setErrorMessage(error.message);
        if (typeof onError === "function") {
          onError(error, messages);
        }
      }
    }),
    [initialMessages, onError, onMessage, transport]
  );

  const { messages, isLoading, sendMessage, stop } = useAiAgentChat(stableConfig);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const value = input.trim();
      if (!value.length || isLoading) {
        return;
      }
      setErrorMessage("");
      setInput("");
      try {
        await sendMessage(value);
      } catch (error) {
        const nextError = error instanceof Error ? error.message : "Failed to send message.";
        setErrorMessage(nextError);
      }
    },
    [input, isLoading, sendMessage]
  );

  return (
    <section className={`ai-agent-chat ${className}`.trim()}>
      <div className="ai-agent-chat__messages" role="log" aria-live="polite">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`ai-agent-chat__message ai-agent-chat__message--${message.role}`}
          >
            <p>{message.content}</p>
            {Array.isArray(message.recommendations) && message.recommendations.length > 0 ? (
              <ul>
                {message.recommendations.slice(0, 5).map((item) => (
                  <li key={`${item.id || item.title}`}>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>

      <form className="ai-agent-chat__composer" onSubmit={onSubmit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim().length}>
          {sendLabel}
        </button>
        <button type="button" onClick={stop} disabled={!isLoading}>
          {stopLabel}
        </button>
      </form>

      {errorMessage ? <p className="ai-agent-chat__error">{errorMessage}</p> : null}
    </section>
  );
}
