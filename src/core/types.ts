export type AgentName = string;

export interface AgentMetadata {
  course_id?: number;
}

export interface PromptInfo {
  version: string;
  hash: string;
}

export interface ToolResult {
  id: string;
  name: string;
  output: unknown;
}

export interface RespondResponse {
  session_id: number;
  user_message_id: number;
  assistant_message_id: number;
  message: string;
  model: string;
  response_id: string;
  prompt: PromptInfo;
  tool_results?: ToolResult[];
}

export interface RecommendationItem {
  id: number | string | null;
  title: string;
  description: string;
  url: string;
  type: string;
  status: string | null;
  progress: number | null;
  is_eligible: boolean;
  in_playlist: boolean;
}

export interface RecommendationOutput {
  count: number;
  next: string | null;
  previous: string | null;
  results: RecommendationItem[];
}

export interface CourseDetailOutput {
  course: {
    id: number;
    title: string;
    description: string;
    modality: string;
    status: string | null;
    content_in_sequence: boolean;
    min_percentage_finish: number;
    tags: string[];
  };
}

export type ChatRole = "system" | "assistant" | "user";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  recommendations?: RecommendationItem[];
  toolResults?: ToolResult[];
}

export interface GenerateResponseRequest {
  messages: ChatMessage[];
  signal: AbortSignal;
}

export interface GenerateResponseResult {
  content: string;
  usage?: ChatMessage["usage"];
  recommendations?: RecommendationItem[];
  toolResults?: ToolResult[];
}

export type GenerateResponse = (
  request: GenerateResponseRequest
) => Promise<GenerateResponseResult>;

export interface ChatbotCoreConfig {
  generateResponse: GenerateResponse;
  initialMessages?: ChatMessage[];
  onMessage?: (message: ChatMessage, messages: ChatMessage[]) => void;
  onError?: (error: Error, messages: ChatMessage[]) => void;
}

export interface ChatbotState {
  messages: ChatMessage[];
  isLoading: boolean;
}

export type ChatbotSubscriber = (state: ChatbotState) => void;
