export { ChatbotCore } from "./core/chatbot";
export { AiAgentCoreError } from "./core/errors";

export {
  extractCourseDetail,
  extractRecommendationItems,
  extractRecommendationOutput,
  getToolErrors,
  getToolResultsByName
} from "./lib/tool-results";

export type {
  AgentMetadata,
  AgentName,
  ChatMessage,
  ChatRole,
  ChatbotCoreConfig,
  ChatbotState,
  ChatbotSubscriber,
  CourseDetailOutput,
  GenerateResponse,
  GenerateResponseRequest,
  GenerateResponseResult,
  PromptInfo,
  RecommendationItem,
  RecommendationOutput,
  RespondResponse,
  ToolResult
} from "./core/types";
