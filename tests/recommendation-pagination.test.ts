import { describe, expect, it } from "vitest";

import type { RecommendationItem } from "../src/core/types";
import { mergeRecommendationItems } from "../src/lib/recommendation-pagination";

function rec(id: number): RecommendationItem {
  return {
    id,
    title: `Course ${id}`,
    description: `Description ${id}`,
    url: `https://example.com/courses/${id}`,
    type: "Course",
    status: null,
    progress: 0,
    is_eligible: true,
    in_playlist: false
  };
}

describe("mergeRecommendationItems", () => {
  it("appends newly fetched recommendations to existing list", () => {
    const current = Array.from({ length: 8 }, (_, idx) => rec(idx + 1));
    const incoming = [rec(9), rec(10)];

    const merged = mergeRecommendationItems(current, incoming);

    expect(merged).toHaveLength(10);
    expect(merged[8].id).toBe(9);
    expect(merged[9].id).toBe(10);
  });

  it("deduplicates by id and url", () => {
    const current = [rec(1), rec(2)];
    const incoming = [
      rec(2),
      { ...rec(3), id: null, url: "https://example.com/courses/2" },
      rec(4)
    ];

    const merged = mergeRecommendationItems(current, incoming);

    expect(merged).toHaveLength(3);
    expect(merged.map((item) => item.id)).toEqual([1, 2, 4]);
  });

  it("ignores invalid incoming objects", () => {
    const current = [rec(1)];
    const incoming: unknown[] = [null, 123, { foo: "bar" }, { title: "X" }];

    const merged = mergeRecommendationItems(current, incoming);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(1);
  });
});
