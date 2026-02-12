export type AiAgentErrorCode =
  | "invalid_config"
  | "fetch_unavailable"
  | "http_error"
  | "aborted"
  | "network_error"
  | "request_error";

export class AiAgentClientError extends Error {
  readonly code: AiAgentErrorCode;

  constructor(message: string, code: AiAgentErrorCode = "request_error") {
    super(message);
    this.name = "AiAgentClientError";
    this.code = code;
  }
}

export class AiAgentApiError extends AiAgentClientError {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message, "http_error");
    this.name = "AiAgentApiError";
    this.status = status;
    this.body = body;
  }

  get data(): unknown {
    return this.body;
  }
}
