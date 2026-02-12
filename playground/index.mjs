import "dotenv/config";
import { writeFile } from "node:fs/promises";

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

function readCliOptions(argv) {
  const options = {
    message: null,
    agent: null,
    courseId: null,
    json: false
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--message" && argv[i + 1]) {
      options.message = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === "--agent" && argv[i + 1]) {
      options.agent = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === "--course-id" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.courseId = Math.floor(parsed);
      }
      i += 1;
      continue;
    }

    if (token === "--json") {
      options.json = true;
      continue;
    }
  }

  return options;
}

function pickDisplayMessage(message, recommendationItems, preferToolResults) {
  if (!preferToolResults || recommendationItems.length === 0) {
    return message;
  }

  const firstNonEmptyLine =
    message
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) || message;

  if (!firstNonEmptyLine || /^\d+[\.\)]\s/.test(firstNonEmptyLine)) {
    return "Berikut rekomendasi kursus yang relevan. Silakan lihat daftar pada tool_results.";
  }

  return firstNonEmptyLine;
}

async function main() {
  const cli = readCliOptions(process.argv);
  const baseUrl = process.env.AI_AGENT_BASE_URL;
  if (!baseUrl) {
    throw new Error("AI_AGENT_BASE_URL is required.");
  }

  const token = process.env.AI_AGENT_TOKEN || undefined;
  const retries = Number(process.env.AI_AGENT_RETRY || 1);
  const timeoutMs = Number(process.env.AI_AGENT_TIMEOUT_MS || 30000);
  const checkHealth = process.env.AI_AGENT_CHECK_HEALTH === "1";
  const preferToolResults = process.env.AI_AGENT_PREFER_TOOL_RESULTS !== "0";
  const writeRawResponse = process.env.AI_AGENT_WRITE_RAW_RESPONSE !== "0";
  const rawResponsePath =
    process.env.AI_AGENT_RAW_RESPONSE_PATH || ".last-response.json";

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

  const metadata = parseJsonEnv("AI_AGENT_METADATA_JSON", {});
  if (cli.courseId) {
    metadata.course_id = cli.courseId;
  }

  const payload = {
    agent: cli.agent || process.env.AI_AGENT_AGENT || "home-assistant",
    message:
      cli.message ||
      process.env.AI_AGENT_MESSAGE ||
      "berikan saya rekomendasi course mengenai kepemimpinan dong",
    metadata
  };

  const response = await client.respond(payload);

  const recommendationItems = extractRecommendationItems(response);
  const courseDetail = extractCourseDetail(response);
  const toolErrors = getToolErrors(response);
  const displayMessage = pickDisplayMessage(
    response.message,
    recommendationItems,
    preferToolResults
  );

  if (writeRawResponse) {
    await writeFile(rawResponsePath, `${JSON.stringify(response, null, 2)}\n`, "utf8");
  }

  if (cli.json) {
    console.log(
      JSON.stringify(
        {
          display_message: displayMessage,
          raw_message: response.message,
          prompt: response.prompt,
          tool_summary: {
            toolResultsCount: response.tool_results?.length || 0,
            recommendationCount: recommendationItems.length,
            hasCourseDetail: Boolean(courseDetail),
            toolErrors
          },
          recommendation_items: recommendationItems,
          course_detail: courseDetail,
          raw_response_path: writeRawResponse ? rawResponsePath : null
        },
        null,
        2
      )
    );
    return;
  }

  console.log("\n=== AI MESSAGE (display) ===");
  console.log(displayMessage);

  if (displayMessage !== response.message) {
    console.log("\n=== AI MESSAGE (raw) ===");
    console.log(response.message);
  }

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

  if (writeRawResponse) {
    console.log(`\nRaw response saved to: ${rawResponsePath}`);
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
