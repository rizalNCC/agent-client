import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SubmitEvent,
  type ReactNode,
} from "react";
import { ChatbotCore } from "../core/chatbot";
import {
  extractRecommendationItems,
  extractRecommendationOutput,
} from "../lib/tool-results";
import { mergeRecommendationItems } from "../lib/recommendation-pagination";
import type {
  AgentMetadata,
  ChatMessage,
  ChatbotCoreConfig,
  ChatbotState,
  GenerateResponse,
  RespondResponse,
} from "../core/types";

const EMPTY_METADATA: AgentMetadata = {};

export interface UseAiAgentChatResult extends ChatbotState {
  sendMessage: (text: string) => Promise<ChatMessage | undefined>;
  stop: () => void;
  updateMessageById: (
    messageId: string,
    updater: (message: ChatMessage) => ChatMessage,
  ) => void;
}

export function useAiAgentChat(
  config: ChatbotCoreConfig,
): UseAiAgentChatResult {
  const coreRef = useRef<ChatbotCore | null>(null);
  const [state, setState] = useState<ChatbotState>({
    messages: [],
    isLoading: false,
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
    [],
  );

  return {
    ...state,
    sendMessage,
    stop,
    updateMessageById,
  };
}

export interface AiAgentChatProps {
  generateResponse?: GenerateResponse;
  suggestedMessages?: string[];
  onMessage?: ChatbotCoreConfig["onMessage"];
  onError?: ChatbotCoreConfig["onError"];
  baseURL?: string;
  accessToken?:
    | string
    | (() => string | undefined | Promise<string | undefined>);
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
  layout?: "inline" | "floating" | "dropdown";
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  panelHeight?: string;
  floatingPosition?: "bottom-right" | "bottom-left";
  zIndex?: number;
  openLabel?: string;
  closeLabel?: string;
}

async function resolveAccessToken(
  provider: AiAgentChatProps["accessToken"],
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
  const full =
    value.length === 3
      ? value
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : value;
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
  stopLabel = "Stop",
  layout = "inline",
  open,
  defaultOpen,
  onOpenChange,
  panelHeight,
  floatingPosition = "bottom-right",
  zIndex = 60,
  openLabel = "Open chat",
  closeLabel = "Close chat",
}: AiAgentChatProps) {
  const [input, setInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [loadingMoreMessageIds, setLoadingMoreMessageIds] = useState<
    Record<string, boolean>
  >({});
  const [internalOpen, setInternalOpen] = useState<boolean>(() => {
    if (layout === "inline") {
      return true;
    }
    if (typeof defaultOpen === "boolean") {
      return defaultOpen;
    }
    return false;
  });
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const resolvedMetadata = useMemo(
    () => metadata || EMPTY_METADATA,
    [metadata],
  );
  const normalizedSuggestions = useMemo(
    () =>
      Array.isArray(suggestedMessages)
        ? suggestedMessages.filter(
            (item) => typeof item === "string" && item.trim().length > 0,
          )
        : [],
    [suggestedMessages],
  );

  const transport = useCallback<GenerateResponse>(
    async ({ messages, signal }) => {
      if (typeof generateResponse === "function") {
        return generateResponse({ messages, signal });
      }

      if (!baseURL || !baseURL.trim()) {
        throw new Error(
          "AiAgentChat requires `baseURL` when `generateResponse` is not provided.",
        );
      }

      const token = await resolveAccessToken(accessToken);
      if (!token) {
        throw new Error(
          "AiAgentChat requires `accessToken` when `generateResponse` is not provided.",
        );
      }

      const headers = new Headers(requestHeaders);
      headers.set("content-type", "application/json");
      headers.set("authorization", `Bearer ${token}`);

      const latestUser = [...messages]
        .reverse()
        .find((item) => item.role === "user");
      const userMessage = latestUser?.content || "";

      const resolvedPath = resolveRespondPath(baseURL, respondPath);
      const response = await fetch(
        `${normalizeBaseURL(baseURL)}${resolvedPath}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            agent,
            message: userMessage,
            metadata: resolvedMetadata,
          }),
          signal,
        },
      );

      const raw = (await response.json()) as
        | RespondResponse
        | { detail?: string; message?: string };
      if (!response.ok) {
        const detail =
          typeof raw === "object" && raw
            ? "detail" in raw && typeof raw.detail === "string"
              ? raw.detail
              : "message" in raw && typeof raw.message === "string"
                ? raw.message
                : ""
            : "";
        throw new Error(
          `AI Agent request failed (${response.status})${detail ? `: ${detail}` : ""}`,
        );
      }

      const backendResponse = raw as RespondResponse;
      const recommendationOutput = extractRecommendationOutput(backendResponse);
      return {
        content: backendResponse.message,
        toolResults: backendResponse.tool_results,
        recommendations: extractRecommendationItems(backendResponse),
        recommendationNext: recommendationOutput?.next ?? null,
      };
    },
    [
      accessToken,
      agent,
      baseURL,
      generateResponse,
      requestHeaders,
      respondPath,
      resolvedMetadata,
    ],
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
      },
    }),
    [onError, onMessage, transport],
  );

  const { messages, isLoading, sendMessage, stop, updateMessageById } =
    useAiAgentChat(stableConfig);

  const onSubmit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
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
        const nextError =
          error instanceof Error ? error.message : "Failed to send message.";
        setErrorMessage(nextError);
      }
    },
    [input, isLoading, sendMessage],
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
        const nextError =
          error instanceof Error ? error.message : "Failed to send message.";
        setErrorMessage(nextError);
      }
    },
    [isLoading, sendMessage],
  );

  const hasUserMessage = messages.some((message) => message.role === "user");
  const isControlledOpen = typeof open === "boolean";
  const isOpen =
    layout === "inline" ? true : isControlledOpen ? (open as boolean) : internalOpen;

  const setOpenState = useCallback(
    (nextOpen: boolean) => {
      if (layout === "inline") {
        return;
      }
      if (!isControlledOpen) {
        setInternalOpen(nextOpen);
      }
      if (typeof onOpenChange === "function") {
        onOpenChange(nextOpen);
      }
    },
    [isControlledOpen, layout, onOpenChange],
  );

  useEffect(() => {
    if (isControlledOpen) {
      return;
    }
    if (layout === "inline") {
      setInternalOpen(true);
      return;
    }
    if (typeof defaultOpen === "boolean") {
      setInternalOpen(defaultOpen);
      return;
    }
    setInternalOpen(false);
  }, [defaultOpen, isControlledOpen, layout]);

  // auto scroll
  useEffect(() => {
    const node = messagesContainerRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [messages, isLoading]);

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

        const requestUrl = new URL(
          nextUrl,
          `${normalizeBaseURL(baseURL)}/`,
        ).toString();
        const response = await fetch(requestUrl, {
          method: "GET",
          headers,
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
            `Load more failed (${response.status})${detail ? `: ${detail}` : ""}`,
          );
        }

        const newResults = Array.isArray(raw?.results) ? raw.results : [];
        const nextPointer =
          typeof raw?.next === "string" || raw?.next === null ? raw.next : null;

        updateMessageById(messageId, (message) => {
          const current = Array.isArray(message.recommendations)
            ? message.recommendations
            : [];
          const merged = mergeRecommendationItems(current, newResults);

          return {
            ...message,
            recommendations: merged,
            recommendationNext: nextPointer,
          };
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load more recommendations.",
        );
      } finally {
        setLoadingMoreMessageIds((prev) => ({ ...prev, [messageId]: false }));
      }
    },
    [
      accessToken,
      baseURL,
      loadingMoreMessageIds,
      requestHeaders,
      updateMessageById,
    ],
  );
  const shellStyle = useMemo(
    () =>
      ({
        "--chat-primary": primaryColor,
        "--chat-primary-rgb": resolvePrimaryRgb(primaryColor),
        "--chat-primary-foreground": primaryForeground,
        ...(typeof panelHeight === "string" && panelHeight.trim()
          ? { "--chat-panel-height": panelHeight.trim() }
          : {}),
        "--chat-shell-z-index": zIndex,
      }) as CSSProperties,
    [panelHeight, primaryColor, primaryForeground, zIndex],
  );

  const chatPanel = (
    <section className={`ai-agent-chat ${className}`.trim()}>
      <header className="ai-agent-chat__header">
        <div className="ai-agent-chat__header-avatar" aria-hidden="true">
          {assistantAvatar ? (
            assistantAvatar
          ) : assistantAvatarUrl ? (
            <img src={assistantAvatarUrl} alt="" />
          ) : initials ? (
            assistantInitials
          ) : (
            ""
          )}
        </div>
        <div className="ai-agent-chat__header-copy">
          <strong>{headerTitle}</strong>
          <span>{headerDescription}</span>
        </div>
      </header>

      <div
        className="ai-agent-chat__messages"
        role="log"
        aria-live="polite"
        ref={messagesContainerRef}
      >
        {!messages.length && !isLoading ? (
          <div className="ai-agent-chat__empty" aria-hidden="true">
            <div className="ai-agent-chat__empty-icon">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M12 2.5a.75.75 0 0 1 .73.57l1.02 4a.75.75 0 0 0 .53.53l4 1.02a.75.75 0 0 1 0 1.46l-4 1.02a.75.75 0 0 0-.53.53l-1.02 4a.75.75 0 0 1-1.46 0l-1.02-4a.75.75 0 0 0-.53-.53l-4-1.02a.75.75 0 0 1 0-1.46l4-1.02a.75.75 0 0 0 .53-.53l1.02-4A.75.75 0 0 1 12 2.5Z" />
                <path d="M18.5 15a.75.75 0 0 1 .73.57l.35 1.37a.75.75 0 0 0 .53.53l1.37.35a.75.75 0 0 1 0 1.46l-1.37.35a.75.75 0 0 0-.53.53l-.35 1.37a.75.75 0 0 1-1.46 0l-.35-1.37a.75.75 0 0 0-.53-.53l-1.37-.35a.75.75 0 0 1 0-1.46l1.37-.35a.75.75 0 0 0 .53-.53l.35-1.37a.75.75 0 0 1 .73-.57Z" />
              </svg>
            </div>
            <strong>Start a conversation</strong>
            <span>Ask about courses, recommendations, or learning plans.</span>
          </div>
        ) : null}
        {messages.map((message) => (
          <article
            key={message.id}
            className={`ai-agent-chat__message ai-agent-chat__message--${message.role}`}
          >
            {initials ? (
              <span className="ai-agent-chat__message-role">
                {message.role === "assistant"
                  ? assistantInitials
                  : userInitials}
              </span>
            ) : null}
            <p>{message.content}</p>
            {Array.isArray(message.recommendations) &&
            message.recommendations.length > 0 ? (
              <div className="ai-agent-chat__recommendation-block">
                <div className="chat-carousel">
                  {message.recommendations.map((item) => {
                    const status =
                      typeof item.status === "string" && item.status.trim()
                        ? item.status.trim()
                        : "";
                    const type =
                      typeof item.type === "string" && item.type.trim()
                        ? item.type.trim()
                        : "";
                    const hasProgress =
                      typeof item.progress === "number" &&
                      Number.isFinite(item.progress);
                    const progressValue = hasProgress
                      ? Math.min(
                          100,
                          Math.max(0, Math.round(item.progress as number)),
                        )
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
                          {type ? (
                            <span className="chat-carousel-chip chat-carousel-chip--type">
                              {type}
                            </span>
                          ) : null}
                          {status ? (
                            <span
                              className="chat-carousel-chip chat-carousel-chip--status"
                              data-status={status.toLowerCase()}
                            >
                              {status}
                            </span>
                          ) : null}
                          {item.in_playlist ? (
                            <span className="chat-carousel-chip chat-carousel-chip--muted">
                              In playlist
                            </span>
                          ) : null}
                        </div>

                        <div className="chat-carousel-card-content">
                          <div className="chat-carousel-card-title">
                            {item.title || "Untitled Course"}
                          </div>
                          <div className="chat-carousel-card-desc">
                            {item.description || ""}
                          </div>
                        </div>

                        <div className="chat-carousel-card-footer">
                          <div className="chat-carousel-meta">
                            {hasProgress ? (
                              <>
                                <span className="chat-carousel-meta-text">
                                  {progressValue}% complete
                                </span>
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
                  {loadingMoreMessageIds[message.id]
                    ? Array.from({ length: 3 }).map((_, index) => (
                        <div
                          key={`skeleton-${message.id}-${index}`}
                          className="chat-carousel-card chat-carousel-card--skeleton"
                          aria-hidden="true"
                        >
                          <div className="chat-carousel-skeleton-line chat-carousel-skeleton-line--chip" />
                          <div className="chat-carousel-skeleton-line chat-carousel-skeleton-line--title" />
                          <div className="chat-carousel-skeleton-line chat-carousel-skeleton-line--desc" />
                          <div className="chat-carousel-skeleton-line chat-carousel-skeleton-line--desc-short" />
                          <div className="chat-carousel-skeleton-line chat-carousel-skeleton-line--cta" />
                        </div>
                      ))
                    : null}
                </div>
                {message.recommendationNext ? (
                  <button
                    type="button"
                    className="ai-agent-chat__loadmore"
                    onClick={() =>
                      void loadMoreRecommendations(
                        message.id,
                        message.recommendationNext!,
                      )
                    }
                    disabled={Boolean(loadingMoreMessageIds[message.id])}
                  >
                    {loadingMoreMessageIds[message.id] ? (
                      <>
                        <span
                          className="ai-agent-chat__spinner"
                          aria-hidden="true"
                        />
                        Loading...
                      </>
                    ) : (
                      "Load more"
                    )}
                  </button>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
        {isLoading ? (
          <article className="ai-agent-chat__message ai-agent-chat__message--assistant ai-agent-chat__message--typing">
            {initials ? (
              <span className="ai-agent-chat__message-role">
                {assistantInitials}
              </span>
            ) : null}
            <p className="ai-agent-chat__typing">
              <span className="ai-agent-chat__typing-dot" aria-hidden="true" />
              <span className="ai-agent-chat__typing-dot" aria-hidden="true" />
              <span className="ai-agent-chat__typing-dot" aria-hidden="true" />
            </p>
          </article>
        ) : null}
      </div>

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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M5.25 3A2.25 2.25 0 0 0 3 5.25v9.5A2.25 2.25 0 0 0 5.25 17h9.5A2.25 2.25 0 0 0 17 14.75v-9.5A2.25 2.25 0 0 0 14.75 3h-9.5Z" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
            </svg>
          )}
        </button>
      </form>

      {errorMessage ? (
        <p className="ai-agent-chat__error">{errorMessage}</p>
      ) : null}
    </section>
  );

  if (layout === "floating") {
    return (
      <div
        className={`ai-agent-chat-shell ai-agent-chat-shell--floating ai-agent-chat-shell--${floatingPosition} ${isOpen ? "ai-agent-chat-shell--open" : "ai-agent-chat-shell--closed"}`.trim()}
        style={shellStyle}
      >
        <div className="ai-agent-chat-shell__panel">{chatPanel}</div>
        <button
          type="button"
          className={`ai-agent-chat-shell__toggle ai-agent-chat-shell__toggle--floating ${isOpen ? "is-open" : ""}`.trim()}
          onClick={() => setOpenState(!isOpen)}
          aria-expanded={isOpen}
          aria-label={isOpen ? closeLabel : openLabel}
          title={isOpen ? closeLabel : openLabel}
        >
          <svg
            className="ai-agent-chat-shell__toggle-icon ai-agent-chat-shell__toggle-icon--open"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M12 6V2H8" />
            <path d="M15 11v2" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="M20 16a2 2 0 0 1-2 2H8.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 4 20.286V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
            <path d="M9 11v2" />
          </svg>
          <svg
            className="ai-agent-chat-shell__toggle-icon ai-agent-chat-shell__toggle-icon--close"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
            <path d="m14.5 8.5-5 5" />
            <path d="m9.5 8.5 5 5" />
          </svg>
        </button>
      </div>
    );
  }

  if (layout === "dropdown") {
    return (
      <div
        className={`ai-agent-chat-shell ai-agent-chat-shell--dropdown ${isOpen ? "ai-agent-chat-shell--open" : "ai-agent-chat-shell--closed"}`.trim()}
        style={shellStyle}
      >
        <button
          type="button"
          className="ai-agent-chat-shell__toggle ai-agent-chat-shell__toggle--dropdown"
          onClick={() => setOpenState(!isOpen)}
          aria-expanded={isOpen}
          aria-label={isOpen ? closeLabel : openLabel}
          title={isOpen ? closeLabel : openLabel}
        >
          <span className="ai-agent-chat-shell__toggle-copy">
            <strong>{headerTitle}</strong>
            <span>{headerDescription}</span>
          </span>
          <span className="ai-agent-chat-shell__caret" aria-hidden="true" />
        </button>
        <div className="ai-agent-chat-shell__panel">{chatPanel}</div>
      </div>
    );
  }

  return (
    <div className="ai-agent-chat-shell ai-agent-chat-shell--inline" style={shellStyle}>
      {chatPanel}
    </div>
  );
}
