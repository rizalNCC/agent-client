import "dotenv/config";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AiAgentApiError,
  AiAgentClientError,
  createAiAgentClient,
  extractCourseDetail,
  extractRecommendationItems,
  getToolErrors
} from "@rizal_ncc/agent-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
const uiDir = join(__dirname, "ui");
const port = Number(process.env.PLAYGROUND_UI_PORT || 4173);

const client = createAiAgentClient({
  baseUrl: process.env.AI_AGENT_BASE_URL || "http://localhost:8000/api/v2",
  getAccessToken: process.env.AI_AGENT_TOKEN || undefined,
  timeoutMs: Number(process.env.AI_AGENT_TIMEOUT_MS || 30000),
  retry: { retries: Number(process.env.AI_AGENT_RETRY || 1), backoffMs: 250, maxBackoffMs: 1200 }
});

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        reject(new Error("Request body too large."));
      }
    });
    req.on("end", () => {
      if (!data.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function getContentType(pathname) {
  const ext = extname(pathname);
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function normalizeMessage(message, recommendationItems) {
  if (!recommendationItems.length) {
    return message;
  }
  const firstLine = message
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine || "Berikut rekomendasi kursus yang relevan.";
}

async function handleRespond(req, res) {
  try {
    const body = await parseBody(req);
    const message = String(body.message || "").trim();
    const agent = String(body.agent || "home-assistant");
    const courseId = body.course_id ? Number(body.course_id) : null;

    if (!message) {
      sendJson(res, 400, { detail: "`message` is required." });
      return;
    }

    const metadata = {};
    if (Number.isFinite(courseId) && courseId > 0) {
      metadata.course_id = Math.floor(courseId);
    }

    const response = await client.respond({ agent, message, metadata });
    const recommendationItems = extractRecommendationItems(response);
    const courseDetail = extractCourseDetail(response);
    const toolErrors = getToolErrors(response);

    sendJson(res, 200, {
      display_message: normalizeMessage(response.message, recommendationItems),
      raw_message: response.message,
      prompt: response.prompt,
      recommendation_items: recommendationItems,
      course_detail: courseDetail,
      tool_errors: toolErrors,
      tool_results: response.tool_results || [],
      raw_response: response
    });
  } catch (error) {
    if (error instanceof AiAgentApiError) {
      sendJson(res, error.status, {
        detail: error.message,
        code: error.code,
        body: error.body
      });
      return;
    }
    if (error instanceof AiAgentClientError) {
      sendJson(res, 500, { detail: error.message, code: error.code });
      return;
    }
    sendJson(res, 500, {
      detail: error instanceof Error ? error.message : "Unexpected error."
    });
  }
}

async function handleStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = join(uiDir, pathname);

  try {
    const content = await readFile(filePath);
    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization"
    });
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/api/respond") {
    await handleRespond(req, res);
    return;
  }

  if (req.method === "GET") {
    await handleStatic(req, res);
    return;
  }

  sendJson(res, 405, { detail: "Method not allowed." });
});

server.listen(port, () => {
  console.log(`Playground UI running at http://localhost:${port}`);
});
