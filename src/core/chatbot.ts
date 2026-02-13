import { AiAgentCoreError } from "./errors";
import type {
  ChatMessage,
  ChatbotCoreConfig,
  ChatbotState,
  ChatbotSubscriber,
  GenerateResponseResult
} from "./types";

function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    role,
    content,
    createdAt: new Date().toISOString()
  };
}

export class ChatbotCore {
  private config: ChatbotCoreConfig;
  private subscribers = new Set<ChatbotSubscriber>();
  private state: ChatbotState;
  private abortController: AbortController | null = null;

  constructor(config: ChatbotCoreConfig) {
    if (!config || typeof config.generateResponse !== "function") {
      throw new AiAgentCoreError(
        "generateResponse function is required.",
        "invalid_config"
      );
    }

    this.config = config;
    this.state = {
      messages: [],
      isLoading: false
    };
  }

  getState(): ChatbotState {
    return {
      messages: [...this.state.messages],
      isLoading: this.state.isLoading
    };
  }

  subscribe(subscriber: ChatbotSubscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.getState());
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      this.setState({ isLoading: false });
    }
  }

  destroy(): void {
    this.stop();
    this.subscribers.clear();
  }

  async sendMessage(text: string): Promise<ChatMessage | undefined> {
    const message = typeof text === "string" ? text.trim() : "";
    if (!message) {
      return undefined;
    }

    if (this.abortController) {
      this.abortController.abort();
    }

    const userMessage = createMessage("user", message);
    this.setState({
      messages: [...this.state.messages, userMessage],
      isLoading: true
    });

    const controller = new AbortController();
    this.abortController = controller;

    try {
      const response = await this.config.generateResponse({
        messages: [...this.state.messages],
        signal: controller.signal
      });

      if (controller.signal.aborted) {
        throw new AiAgentCoreError("Generation aborted.", "aborted");
      }

      const assistantMessage = this.createAssistantMessage(response);
      const nextMessages = [...this.state.messages, assistantMessage];

      this.setState({
        messages: nextMessages,
        isLoading: false
      });

      if (typeof this.config.onMessage === "function") {
        this.config.onMessage(assistantMessage, [...nextMessages]);
      }

      return assistantMessage;
    } catch (error) {
      if (controller.signal.aborted) {
        this.setState({ isLoading: false });
        return undefined;
      }

      const normalizedError =
        error instanceof Error
          ? error
          : new AiAgentCoreError("Failed to generate assistant response.");

      this.setState({ isLoading: false });

      if (typeof this.config.onError === "function") {
        this.config.onError(normalizedError, [...this.state.messages]);
      }

      throw normalizedError;
    } finally {
      if (this.abortController === controller) {
        this.abortController = null;
      }
    }
  }

  private createAssistantMessage(response: GenerateResponseResult): ChatMessage {
    const content =
      response && typeof response.content === "string" ? response.content.trim() : "";

    if (!content) {
      throw new AiAgentCoreError(
        "generateResponse must return a non-empty content string.",
        "response_error"
      );
    }

    return {
      ...createMessage("assistant", content),
      usage: response.usage,
      recommendations: response.recommendations,
      toolResults: response.toolResults
    };
  }

  private setState(next: Partial<ChatbotState>): void {
    this.state = {
      messages: next.messages ? [...next.messages] : this.state.messages,
      isLoading: typeof next.isLoading === "boolean" ? next.isLoading : this.state.isLoading
    };

    const snapshot = this.getState();
    for (const subscriber of this.subscribers) {
      subscriber(snapshot);
    }
  }
}
