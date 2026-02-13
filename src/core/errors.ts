export class AiAgentCoreError extends Error {
  readonly code: "invalid_config" | "aborted" | "response_error";

  constructor(
    message: string,
    code: "invalid_config" | "aborted" | "response_error" = "response_error"
  ) {
    super(message);
    this.name = "AiAgentCoreError";
    this.code = code;
  }
}
