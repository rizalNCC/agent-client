import { describe, expect, it } from "vitest";

import {
  extractCourseDetail,
  extractRecommendationItems,
  extractRecommendationOutput,
  getToolErrors,
  getToolResultsByName,
  type RespondResponse
} from "../src/index";

const responseWithTools: RespondResponse = {
  session_id: 1,
  user_message_id: 1,
  assistant_message_id: 2,
  message: "Summary",
  model: "gpt-4o-mini",
  response_id: "resp_1",
  prompt: { version: "v1", hash: "x" },
  tool_results: [
    {
      id: "call_detail",
      name: "get_course_detail",
      output: {
        course: {
          id: 28,
          title: "Leadership",
          description: "desc",
          modality: "Learn",
          status: null,
          content_in_sequence: false,
          min_percentage_finish: 100,
          tags: ["leadership"]
        }
      }
    },
    {
      id: "call_reco",
      name: "get_course_recommendation",
      output: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 100,
            title: "Agile Leadership",
            description: "desc",
            url: "https://example.com/course/100",
            type: "Course",
            status: null,
            progress: 0,
            is_eligible: true,
            in_playlist: false
          }
        ]
      }
    }
  ]
};

describe("tool results helpers", () => {
  it("filters tool results by name", () => {
    const items = getToolResultsByName(responseWithTools, "get_course_detail");
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("call_detail");
  });

  it("extracts recommendation output and items", () => {
    const output = extractRecommendationOutput(responseWithTools);
    expect(output?.count).toBe(1);

    const items = extractRecommendationItems(responseWithTools);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Agile Leadership");
  });

  it("extracts course detail output", () => {
    const detail = extractCourseDetail(responseWithTools);
    expect(detail?.course.id).toBe(28);
  });

  it("collects tool error messages", () => {
    const response: RespondResponse = {
      ...responseWithTools,
      tool_results: [
        {
          id: "call_error",
          name: "get_course_recommendation",
          output: { error: "Failed" }
        }
      ]
    };

    expect(getToolErrors(response)).toEqual(["Failed"]);
  });
});
