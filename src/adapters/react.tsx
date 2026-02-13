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

  return {
    ...state,
    sendMessage,
    stop
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
      return {
        content: backendResponse.message,
        toolResults: backendResponse.tool_results,
        recommendations: extractRecommendationItems(backendResponse)
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
            assistantInitials
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
            <span className="ai-agent-chat__message-role">
              {message.role === "assistant" ? assistantInitials : userInitials}
            </span>
            <p>{message.content}</p>
            {Array.isArray(message.recommendations) && message.recommendations.length > 0 ? (
              <ul className="ai-agent-chat__recommendations">
                {message.recommendations.slice(0, 5).map((item) => (
                  <li className="ai-agent-chat__recommendation-card" key={`${item.id || item.title}`}>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
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
