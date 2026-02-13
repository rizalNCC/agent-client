import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode
} from "react";
import { ChatbotCore } from "../core/chatbot";
import { extractRecommendationItems, extractRecommendationOutput } from "../lib/tool-results";
import type {
  AgentMetadata,
  ChatMessage,
  ChatbotCoreConfig,
  ChatbotState,
  GenerateResponse,
  RecommendationItem,
  RespondResponse
} from "../core/types";

const EMPTY_METADATA: AgentMetadata = {};

export interface UseAiAgentChatResult extends ChatbotState {
  sendMessage: (text: string) => Promise<ChatMessage | undefined>;
  stop: () => void;
  updateMessageById: (
    messageId: string,
    updater: (message: ChatMessage) => ChatMessage
  ) => void;
}

export function useAiAgentChat(config: ChatbotCoreConfig): UseAiAgentChatResult {
  const coreRef = useRef<ChatbotCore | null>(null);
  const [state, setState] = useState<ChatbotState>({
    messages: [],
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

  const updateMessageById = useCallback(
    (messageId: string, updater: (message: ChatMessage) => ChatMessage) => {
      if (!coreRef.current) {
        return;
      }
      coreRef.current.updateMessageById(messageId, updater);
    },
    []
  );

  return {
    ...state,
    sendMessage,
    stop,
    updateMessageById
  };
}

export interface AiAgentChatProps {
  generateResponse?: GenerateResponse;
  suggestedMessages?: string[];
  onMessage?: ChatbotCoreConfig["onMessage"];
  onError?: ChatbotCoreConfig["onError"];
  baseURL?: string;
  accessToken?: string | (() => string | undefined | Promise<string | undefined>);
  agent?: string;
  metadata?: AgentMetadata;
  requestHeaders?: HeadersInit;
  respondPath?: string;
  headerTitle?: string;
  headerDescription?: string;
  assistantAvatar?: ReactNode;
  assistantAvatarUrl?: string;
  assistantInitials?: string;
  userInitials?: string;
  initials?: boolean;
  primaryColor?: string;
  primaryForeground?: string;
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

function hexToRgb(hex: string): string | null {
  const value = hex.trim().replace("#", "");
  if (![3, 6].includes(value.length) || !/^[a-fA-F0-9]+$/.test(value)) {
    return null;
  }
  const full = value.length === 3 ? value.split("").map((char) => `${char}${char}`).join("") : value;
  const red = Number.parseInt(full.slice(0, 2), 16);
  const green = Number.parseInt(full.slice(2, 4), 16);
  const blue = Number.parseInt(full.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
}

function resolvePrimaryRgb(color: string): string {
  const fromHex = hexToRgb(color);
  if (fromHex) {
    return fromHex;
  }

  const rgbMatch = color.match(/rgba?\(([^)]+)\)/i);
  if (!rgbMatch) {
    return "17, 104, 187";
  }

  const channels = rgbMatch[1]
    .split(",")
    .slice(0, 3)
    .map((part) => Number.parseFloat(part.trim()))
    .filter((value) => Number.isFinite(value));
  if (channels.length !== 3) {
    return "17, 104, 187";
  }

  return `${channels[0]}, ${channels[1]}, ${channels[2]}`;
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
  suggestedMessages = [],
  headerTitle = "BAWANA Assistant",
  headerDescription = "Online and ready to help",
  assistantAvatar,
  assistantAvatarUrl = "/ai-img.svg",
  assistantInitials = "AI",
  userInitials = "YOU",
  initials = true,
  primaryColor = "#1168bb",
  primaryForeground = "#ffffff",
  onMessage,
  onError,
  className = "",
  placeholder = "Ask the assistant...",
  sendLabel = "Send",
  stopLabel = "Stop"
}: AiAgentChatProps) {
  const [input, setInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [loadingMoreMessageIds, setLoadingMoreMessageIds] = useState<Record<string, boolean>>({});
  const resolvedMetadata = useMemo(() => metadata || EMPTY_METADATA, [metadata]);
  const normalizedSuggestions = useMemo(
    () =>
      Array.isArray(suggestedMessages)
        ? suggestedMessages.filter((item) => typeof item === "string" && item.trim().length > 0)
        : [],
    [suggestedMessages]
  );

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
      const recommendationOutput = extractRecommendationOutput(backendResponse);
      return {
        content: backendResponse.message,
        toolResults: backendResponse.tool_results,
        recommendations: extractRecommendationItems(backendResponse),
        recommendationNext: recommendationOutput?.next ?? null
      };
    },
    [
      accessToken,
      agent,
      baseURL,
      generateResponse,
      requestHeaders,
      respondPath,
      resolvedMetadata
    ]
  );

  const stableConfig = useMemo<ChatbotCoreConfig>(
    () => ({
      generateResponse: transport,
      onMessage,
      onError: (error, messages) => {
        setErrorMessage(error.message);
        if (typeof onError === "function") {
          onError(error, messages);
        }
      }
    }),
    [onError, onMessage, transport]
  );

  const { messages, isLoading, sendMessage, stop, updateMessageById } = useAiAgentChat(stableConfig);

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

  const onSuggestionClick = useCallback(
    async (text: string) => {
      if (isLoading) {
        return;
      }
      setErrorMessage("");
      setInput("");
      try {
        await sendMessage(text);
      } catch (error) {
        const nextError = error instanceof Error ? error.message : "Failed to send message.";
        setErrorMessage(nextError);
      }
    },
    [isLoading, sendMessage]
  );

  const hasUserMessage = messages.some((message) => message.role === "user");
  const loadMoreRecommendations = useCallback(
    async (messageId: string, nextUrl: string) => {
      if (!nextUrl || loadingMoreMessageIds[messageId]) {
        return;
      }
      if (!baseURL || !baseURL.trim()) {
        setErrorMessage("Cannot load more: baseURL is missing.");
        return;
      }

      const token = await resolveAccessToken(accessToken);
      if (!token) {
        setErrorMessage("Cannot load more: accessToken is missing.");
        return;
      }

      setLoadingMoreMessageIds((prev) => ({ ...prev, [messageId]: true }));
      try {
        const headers = new Headers(requestHeaders);
        headers.set("authorization", `Bearer ${token}`);

        const requestUrl = new URL(nextUrl, `${normalizeBaseURL(baseURL)}/`).toString();
        const response = await fetch(requestUrl, {
          method: "GET",
          headers
        });
        const raw = (await response.json()) as {
          next?: string | null;
          results?: unknown[];
          detail?: string;
          message?: string;
        };

        if (!response.ok) {
          const detail =
            typeof raw?.detail === "string"
              ? raw.detail
              : typeof raw?.message === "string"
                ? raw.message
                : "";
          throw new Error(
            `Load more failed (${response.status})${detail ? `: ${detail}` : ""}`
          );
        }

        const newResults = Array.isArray(raw?.results) ? raw.results : [];
        const nextPointer =
          typeof raw?.next === "string" || raw?.next === null ? raw.next : null;

        updateMessageById(messageId, (message) => {
          const current = Array.isArray(message.recommendations) ? message.recommendations : [];
          const merged = [...current];
          for (const item of newResults) {
            if (!item || typeof item !== "object") {
              continue;
            }
            const rec = item as RecommendationItem;
            const exists = merged.some(
              (existing) =>
                (existing.id !== null && existing.id === rec.id) ||
                (existing.url && rec.url && existing.url === rec.url)
            );
            if (!exists) {
              merged.push(rec);
            }
          }

          return {
            ...message,
            recommendations: merged,
            recommendationNext: nextPointer
          };
        });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to load more recommendations.");
      } finally {
        setLoadingMoreMessageIds((prev) => ({ ...prev, [messageId]: false }));
      }
    },
    [accessToken, baseURL, loadingMoreMessageIds, requestHeaders, updateMessageById]
  );
  const themeStyle = useMemo(
    () =>
      ({
        "--chat-primary": primaryColor,
        "--chat-primary-rgb": resolvePrimaryRgb(primaryColor),
        "--chat-primary-foreground": primaryForeground
      }) as CSSProperties,
    [primaryColor, primaryForeground]
  );

  return (
    <section className={`ai-agent-chat ${className}`.trim()} style={themeStyle}>
      <header className="ai-agent-chat__header">
        <div className="ai-agent-chat__header-avatar" aria-hidden="true">
          {assistantAvatar ? (
            assistantAvatar
          ) : assistantAvatarUrl ? (
            <img src={assistantAvatarUrl} alt="" />
          ) : (
            (initials ? assistantInitials : "")
          )}
        </div>
        <div className="ai-agent-chat__header-copy">
          <strong>{headerTitle}</strong>
          <span>{headerDescription}</span>
        </div>
      </header>

      {!hasUserMessage && normalizedSuggestions.length > 0 ? (
        <div className="ai-agent-chat__suggestions">
          {normalizedSuggestions.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => void onSuggestionClick(text)}
              disabled={isLoading}
            >
              {text}
            </button>
          ))}
        </div>
      ) : null}

      <div className="ai-agent-chat__messages" role="log" aria-live="polite">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`ai-agent-chat__message ai-agent-chat__message--${message.role}`}
          >
            {initials ? (
              <span className="ai-agent-chat__message-role">
                {message.role === "assistant" ? assistantInitials : userInitials}
              </span>
            ) : null}
            <p>{message.content}</p>
            {Array.isArray(message.recommendations) && message.recommendations.length > 0 ? (
              <div className="chat-carousel">
                {message.recommendations.map((item) => {
                  const status =
                    typeof item.status === "string" && item.status.trim() ? item.status.trim() : "";
                  const type = typeof item.type === "string" && item.type.trim() ? item.type.trim() : "";
                  const hasProgress = typeof item.progress === "number" && Number.isFinite(item.progress);
                  const progressValue = hasProgress
                    ? Math.min(100, Math.max(0, Math.round(item.progress as number)))
                    : 0;

                  return (
                    <a
                      className="chat-carousel-card"
                      key={`${item.id || item.title}`}
                      href={item.url || "#"}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <div className="chat-carousel-card-header">
                        {type ? <span className="chat-carousel-chip chat-carousel-chip--type">{type}</span> : null}
                        {status ? (
                          <span
                            className="chat-carousel-chip chat-carousel-chip--status"
                            data-status={status.toLowerCase()}
                          >
                            {status}
                          </span>
                        ) : null}
                        {item.in_playlist ? (
                          <span className="chat-carousel-chip chat-carousel-chip--muted">In playlist</span>
                        ) : null}
                      </div>

                      <div className="chat-carousel-card-content">
                        <div className="chat-carousel-card-title">{item.title || "Untitled Course"}</div>
                        <div className="chat-carousel-card-desc">{item.description || ""}</div>
                      </div>

                      <div className="chat-carousel-card-footer">
                        <div className="chat-carousel-meta">
                          {hasProgress ? (
                            <>
                              <span className="chat-carousel-meta-text">{progressValue}% complete</span>
                              <div className="chat-carousel-progress">
                                <div
                                  className="chat-carousel-progress-bar"
                                  style={{ width: `${progressValue}%` }}
                                />
                              </div>
                            </>
                          ) : null}
                        </div>

                        <div className="chat-carousel-cta">
                          <span>View course</span>
                          <span className="chat-carousel-cta-icon" />
                        </div>
                      </div>
                    </a>
                  );
                })}
                {message.recommendationNext ? (
                  <button
                    type="button"
                    className="chat-carousel-loadmore"
                    onClick={() => void loadMoreRecommendations(message.id, message.recommendationNext!)}
                    disabled={Boolean(loadingMoreMessageIds[message.id])}
                  >
                    {loadingMoreMessageIds[message.id] ? "Loading..." : "Load more"}
                  </button>
                ) : null}
              </div>
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
        <button
          type={isLoading ? "button" : "submit"}
          onClick={isLoading ? stop : undefined}
          className={`ai-agent-chat__action ${isLoading ? "is-stop" : "is-send"}`}
          disabled={!isLoading && !input.trim().length}
          aria-label={isLoading ? stopLabel : sendLabel}
          title={isLoading ? stopLabel : sendLabel}
        >
          {isLoading ? (
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <rect x="7" y="7" width="10" height="10" rx="2" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M3 11.5 20.5 4c.8-.3 1.5.5 1.2 1.2L14.2 22.7c-.4 1-1.8 1-2.2 0l-2.1-5.1-5.1-2.1c-1-.4-1-1.8 0-2.2Z" />
            </svg>
          )}
        </button>
      </form>

      {errorMessage ? <p className="ai-agent-chat__error">{errorMessage}</p> : null}
    </section>
  );
}
