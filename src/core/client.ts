import { requestJson } from "./http";
import type {
  AiAgentClientConfig,
  AiAgentRoutes,
  HealthResponse,
  RequestOptions,
  RespondRequest,
  RespondResponse
} from "./types";
import { validateRespondRequest } from "../lib/validators";

const DEFAULT_ROUTES: AiAgentRoutes = {
  respond: "/ai-agent/respond/",
  health: "/ai-agent/health/"
};

export class AiAgentClient {
  private readonly config: AiAgentClientConfig;
  private readonly routes: AiAgentRoutes;

  constructor(config: AiAgentClientConfig) {
    this.config = config;
    this.routes = {
      ...DEFAULT_ROUTES,
      ...(config.routes || {})
    };
  }

  async respond(payload: RespondRequest, options?: RequestOptions): Promise<RespondResponse> {
    const normalizedPayload = validateRespondRequest(payload);
    return requestJson<RespondResponse>({
      clientConfig: this.config,
      method: "POST",
      path: this.routes.respond,
      body: normalizedPayload,
      options
    });
  }

  async health(options?: RequestOptions): Promise<HealthResponse> {
    return requestJson<HealthResponse>({
      clientConfig: this.config,
      method: "GET",
      path: this.routes.health,
      options
    });
  }
}

export function createAiAgentClient(config: AiAgentClientConfig): AiAgentClient {
  return new AiAgentClient(config);
}
