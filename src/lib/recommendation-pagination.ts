import type { RecommendationItem } from "../core/types";

function asRecommendationItem(value: unknown): RecommendationItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<RecommendationItem>;
  if (typeof item.title !== "string" || typeof item.url !== "string") {
    return null;
  }

  return {
    id:
      typeof item.id === "number" ||
      typeof item.id === "string" ||
      item.id === null
        ? item.id
        : null,
    title: item.title,
    description: typeof item.description === "string" ? item.description : "",
    url: item.url,
    type: typeof item.type === "string" ? item.type : "Course",
    status:
      typeof item.status === "string" || item.status === null
        ? item.status
        : null,
    progress:
      typeof item.progress === "number" || item.progress === null
        ? item.progress
        : null,
    is_eligible: Boolean(item.is_eligible),
    in_playlist: Boolean(item.in_playlist),
  };
}

export function mergeRecommendationItems(
  current: RecommendationItem[],
  incoming: unknown[],
): RecommendationItem[] {
  const merged = Array.isArray(current) ? [...current] : [];

  for (const raw of incoming) {
    const candidate = asRecommendationItem(raw);
    if (!candidate) {
      continue;
    }

    // misalnya kalo ada duplicate, nanti bakalan di skip/hilang. sementara di allow dulu semua masuk buat ngecek juga sih aowkwk
    // const exists = merged.some(
    //   (existing) =>
    //     (existing.id !== null && existing.id === candidate.id) ||
    //     (existing.url && candidate.url && existing.url === candidate.url)
    // );
    //
    // if (!exists) {
    //   merged.push(candidate);
    // }

    merged.push(candidate);
  }

  return merged;
}
