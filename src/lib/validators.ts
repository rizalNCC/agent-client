import { AiAgentClientError } from "../core/errors";
import type { AgentMetadata, RespondRequest } from "../core/types";

const ALLOWED_METADATA_KEYS = new Set(["course_id"]);

function normalizeMetadata(metadata?: AgentMetadata): AgentMetadata | undefined {
  if (metadata === undefined) {
    return undefined;
  }
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new AiAgentClientError("metadata must be a JSON object.");
  }

  const keys = Object.keys(metadata);
  const unknownKeys = keys.filter((key) => !ALLOWED_METADATA_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw new AiAgentClientError(`Unknown metadata keys: ${unknownKeys.join(", ")}.`);
  }

  const courseIdRaw = (metadata as { course_id?: unknown }).course_id;
  if (courseIdRaw === undefined) {
    return {};
  }

  let courseId = courseIdRaw;
  if (typeof courseIdRaw === "string") {
    if (!/^\d+$/.test(courseIdRaw)) {
      throw new AiAgentClientError("metadata.course_id must be a positive integer.");
    }
    courseId = Number.parseInt(courseIdRaw, 10);
  }

  if (
    typeof courseId !== "number" ||
    !Number.isInteger(courseId) ||
    courseId <= 0 ||
    Number.isNaN(courseId)
  ) {
    throw new AiAgentClientError("metadata.course_id must be a positive integer.");
  }

  return { course_id: courseId };
}

export function validateRespondRequest(payload: RespondRequest): RespondRequest {
  if (!payload || typeof payload !== "object") {
    throw new AiAgentClientError("respond payload must be an object.");
  }

  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (!message) {
    throw new AiAgentClientError("message is required and must be a non-empty string.");
  }

  if (payload.agent !== undefined && typeof payload.agent !== "string") {
    throw new AiAgentClientError("agent must be a string.");
  }

  const normalizedMetadata = normalizeMetadata(payload.metadata);

  return {
    ...(payload.agent ? { agent: payload.agent.trim() } : {}),
    message,
    ...(normalizedMetadata !== undefined ? { metadata: normalizedMetadata } : {})
  };
}
