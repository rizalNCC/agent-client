import type {
  CourseDetailOutput,
  RecommendationOutput,
  RespondResponse,
  ToolResult
} from "../core/types";

function ensureToolResults(response: RespondResponse): ToolResult[] {
  return Array.isArray(response.tool_results) ? response.tool_results : [];
}

export function getToolResultsByName(
  response: RespondResponse,
  toolName: string
): ToolResult[] {
  return ensureToolResults(response).filter((item) => item?.name === toolName);
}

export function getToolErrors(response: RespondResponse): string[] {
  return ensureToolResults(response)
    .map((item) => {
      const output = item.output as { error?: unknown };
      return typeof output?.error === "string" ? output.error : "";
    })
    .filter(Boolean);
}

export function extractCourseDetail(
  response: RespondResponse
): CourseDetailOutput | null {
  const first = getToolResultsByName(response, "get_course_detail")[0];
  if (!first || !first.output || typeof first.output !== "object") {
    return null;
  }

  const output = first.output as Partial<CourseDetailOutput>;
  if (!output.course || typeof output.course !== "object") {
    return null;
  }

  return output as CourseDetailOutput;
}

export function extractRecommendationOutput(
  response: RespondResponse
): RecommendationOutput | null {
  const first = getToolResultsByName(response, "get_course_recommendation")[0];
  if (!first || !first.output || typeof first.output !== "object") {
    return null;
  }

  const output = first.output as Partial<RecommendationOutput>;
  if (!Array.isArray(output.results)) {
    return null;
  }

  return {
    count: typeof output.count === "number" ? output.count : output.results.length,
    next: typeof output.next === "string" || output.next === null ? output.next : null,
    previous:
      typeof output.previous === "string" || output.previous === null
        ? output.previous
        : null,
    results: output.results
  } as RecommendationOutput;
}

export function extractRecommendationItems(response: RespondResponse) {
  const output = extractRecommendationOutput(response);
  return output ? output.results : [];
}
