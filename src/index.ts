export { AiAgentClient, createAiAgentClient } from "./core/client";
export { AiAgentApiError, AiAgentClientError } from "./core/errors";
export type { AiAgentErrorCode } from "./core/errors";

export {
  extractCourseDetail,
  extractRecommendationItems,
  extractRecommendationOutput,
  getToolErrors,
  getToolResultsByName
} from "./lib/tool-results";
export { validateRespondRequest } from "./lib/validators";

export type {
  AgentMetadata,
  AiAgentClientConfig,
  AiAgentRoutes,
  CourseDetailOutput,
  HealthResponse,
  PromptInfo,
  RecommendationItem,
  RecommendationOutput,
  RetryOptions,
  RequestOptions,
  RespondRequest,
  RespondResponse,
  ToolResult
} from "./core/types";
