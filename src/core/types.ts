export type AgentName = string;

export interface AgentMetadata {
  course_id?: number;
}

export interface RespondRequest {
  agent?: AgentName;
  message: string;
  metadata?: AgentMetadata;
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

export interface HealthResponse {
  ok: boolean;
  checked: boolean;
  model: string;
  prompt: PromptInfo;
  feature_enabled: boolean;
  error?: string;
  model_id?: string;
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: HeadersInit;
  retry?: RetryOptions | false;
}

export interface AiAgentClientConfig {
  baseUrl: string;
  getAccessToken?: (() => string | undefined | Promise<string | undefined>) | string;
  defaultHeaders?: HeadersInit;
  timeoutMs?: number;
  retry?: RetryOptions;
  fetchImpl?: typeof fetch;
  routes?: Partial<AiAgentRoutes>;
}

export interface AiAgentRoutes {
  respond: string;
  health: string;
}

export interface RetryOptions {
  retries?: number;
  backoffMs?: number;
  maxBackoffMs?: number;
  retryOnStatuses?: number[];
  retryOnNetworkError?: boolean;
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
