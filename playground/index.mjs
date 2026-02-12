import "dotenv/config";

import {
  AiAgentApiError,
  AiAgentClientError,
  createAiAgentClient,
  extractCourseDetail,
  extractRecommendationItems,
  getToolErrors
} from "@rizal_ncc/agent-client";

function parseJsonEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${name} must be valid JSON: ${error.message}`);
  }
}

async function main() {
  const baseUrl = process.env.AI_AGENT_BASE_URL;
  if (!baseUrl) {
    throw new Error("AI_AGENT_BASE_URL is required.");
  }

  const token = process.env.AI_AGENT_TOKEN || undefined;
  const retries = Number(process.env.AI_AGENT_RETRY || 1);
  const timeoutMs = Number(process.env.AI_AGENT_TIMEOUT_MS || 30000);
  const checkHealth = process.env.AI_AGENT_CHECK_HEALTH === "1";

  const client = createAiAgentClient({
    baseUrl,
    getAccessToken: token,
    timeoutMs,
    retry: { retries, backoffMs: 250, maxBackoffMs: 1200 }
  });

  if (checkHealth) {
    const health = await client.health();
    console.log("Health:", health);
  }

  const payload = {
    agent: process.env.AI_AGENT_AGENT || "home-assistant",
    message:
      process.env.AI_AGENT_MESSAGE ||
      "berikan saya rekomendasi course mengenai kepemimpinan dong",
    metadata: parseJsonEnv("AI_AGENT_METADATA_JSON", {})
  };

  const response = await client.respond(payload);

  const recommendationItems = extractRecommendationItems(response);
  const courseDetail = extractCourseDetail(response);
  const toolErrors = getToolErrors(response);

  console.log("\n=== AI MESSAGE (summary) ===");
  console.log(response.message);

  console.log("\n=== PROMPT INFO ===");
  console.log(response.prompt);

  console.log("\n=== TOOL SUMMARY ===");
  console.log({
    toolResultsCount: response.tool_results?.length || 0,
    recommendationCount: recommendationItems.length,
    hasCourseDetail: Boolean(courseDetail),
    toolErrors
  });

  if (recommendationItems.length > 0) {
    console.log("\n=== RECOMMENDATION ITEMS ===");
    console.log(recommendationItems);
  }

  if (courseDetail) {
    console.log("\n=== COURSE DETAIL ===");
    console.log(courseDetail);
  }
}

main().catch((error) => {
  if (error instanceof AiAgentApiError) {
    console.error("API Error:", {
      status: error.status,
      code: error.code,
      body: error.body
    });
    process.exit(1);
  }

  if (error instanceof AiAgentClientError) {
    console.error("Client Error:", {
      code: error.code,
      message: error.message
    });
    process.exit(1);
  }

  console.error("Unexpected Error:", error);
  process.exit(1);
});
