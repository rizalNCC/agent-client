# @rizal_ncc/agent-client

TypeScript client SDK for `nems/ai_agent` backend.

## Install

```bash
npm install @rizal_ncc/agent-client
```

## Usage

```ts
import {
  createAiAgentClient,
  extractRecommendationItems,
  extractCourseDetail
} from "@rizal_ncc/agent-client";

const client = createAiAgentClient({
  baseUrl: "https://your-host/api/v2",
  getAccessToken: async () => "<access_token>"
});

const response = await client.respond({
  agent: "home-assistant",
  message: "rekomendasi course leadership",
  metadata: {}
});

const recommendations = extractRecommendationItems(response);
const courseDetail = extractCourseDetail(response);
```

## Browser Example (React/Vite)

```ts
import { createAiAgentClient, extractRecommendationItems } from "@rizal_ncc/agent-client";

const client = createAiAgentClient({
  baseUrl: "https://your-host/api/v2",
  getAccessToken: () => localStorage.getItem("access_token") || undefined
});

export async function askHomeAssistant(message: string) {
  const res = await client.respond({
    agent: "home-assistant",
    message,
    metadata: {}
  });

  return {
    summary: res.message, // keep as short intro/summary text
    courses: extractRecommendationItems(res), // render cards/list from tool_results
    prompt: res.prompt
  };
}
```

## Node Example (Express/Server Runtime)

```ts
import express from "express";
import { createAiAgentClient, AiAgentApiError, extractRecommendationItems } from "@rizal_ncc/agent-client";

const app = express();
app.use(express.json());

const client = createAiAgentClient({
  baseUrl: process.env.AI_AGENT_BASE_URL!,
  getAccessToken: async () => process.env.AI_AGENT_TOKEN
});

app.post("/api/assistant/recommend-courses", async (req, res) => {
  try {
    const result = await client.respond({
      agent: "home-assistant",
      message: req.body.message,
      metadata: {}
    });

    return res.json({
      summary: result.message,
      items: extractRecommendationItems(result),
      tool_results: result.tool_results || []
    });
  } catch (error) {
    if (error instanceof AiAgentApiError) {
      return res.status(error.status).json({
        error: error.message,
        details: error.body
      });
    }
    return res.status(500).json({ error: "Unexpected server error" });
  }
});
```

## Frontend Contract (Recommended)

- Use `response.message` as conversational text only.
- Render recommendation/course list from `response.tool_results`.
- For recommendation UI, use `extractRecommendationItems(response)`.
- For course detail UI, use `extractCourseDetail(response)`.
- Show tool failures via `getToolErrors(response)` when present.

## API

### `createAiAgentClient(config)`

Config:
- `baseUrl` (required), e.g. `https://host/api/v2`
- `getAccessToken` string or async function
- `defaultHeaders`
- `timeoutMs`
- `retry` default retry policy
- `fetchImpl`
- `routes` override (`respond`, `health`)

`retry` fields:
- `retries` number of retry attempts after first request
- `backoffMs` initial backoff in milliseconds
- `maxBackoffMs` max backoff in milliseconds
- `retryOnStatuses` HTTP statuses eligible for retry
- `retryOnNetworkError` retry on network errors (`TypeError`)

Default behavior:
- `GET` retries up to 2 times for transient failures
- `POST` does not retry unless configured

### `client.respond(payload, options?)`

Payload:
- `agent?: string`
- `message: string` (required)
- `metadata?: { course_id?: number }`

Returns backend response including optional `tool_results`.

Per-request options:
- `signal`
- `timeoutMs`
- `headers`
- `retry` override client retry config, or `false` to disable

### `client.health(options?)`

Returns backend health payload.

### Helpers

- `getToolResultsByName(response, toolName)`
- `extractRecommendationOutput(response)`
- `extractRecommendationItems(response)`
- `extractCourseDetail(response)`
- `getToolErrors(response)`

## Error Handling

- `AiAgentApiError`: HTTP non-2xx response
  - `status`: HTTP status code
  - `body`: parsed response body
  - `data`: alias of `body` (backward compatibility)
  - `code`: `"http_error"`
- `AiAgentClientError`: client/runtime error
  - `code`: `"invalid_config" | "fetch_unavailable" | "aborted" | "network_error" | "request_error"`

## Development

```bash
npm install
npm test
npm run build
```

## Release

```bash
# 1) authenticate once (or set NPM_TOKEN in CI)
npm login

# 2) final checks
npm run release:check

# 3) publish
npm run release:publish
```

Optional git tagging flow:

```bash
git add nems/ai_agent/Dev
git commit -m "release(agent-client): v0.1.1"
git tag v0.1.1
git push origin <your-branch> --tags
```
