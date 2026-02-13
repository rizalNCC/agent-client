# @rizal_ncc/agent-client

UI wrapper + typed helpers for `nems/ai_agent` integrations.

This package is now frontend-only:
- No built-in backend HTTP client
- No OpenAI calls inside the package
- Network/transport is injected via `generateResponse`

`backend-documentation.md` remains the source-of-truth contract for `respond` payload and `tool_results` schema.

## Install

```bash
npm install @rizal_ncc/agent-client
```

## React Usage

```tsx
import { AiAgentChat } from "@rizal_ncc/agent-client/react";
import "@rizal_ncc/agent-client/style.css";

export function App() {
  return (
    <AiAgentChat
      baseURL="https://api.example.com"
      accessToken="your-access-token-here"
      agent="home-assistant"
    />
  );
}
```

## Headless Core Usage

```ts
import { ChatbotCore } from "@rizal_ncc/agent-client";

const bot = new ChatbotCore({
  generateResponse: async () => ({ content: "Hello" })
});

await bot.sendMessage("Hi");
console.log(bot.getState().messages);
```

## Backend Tool Helpers

Helpers parse backend `tool_results` from `POST /api/v2/ai-agent/respond/`:

- `getToolResultsByName(response, toolName)`
- `extractRecommendationOutput(response)`
- `extractRecommendationItems(response)`
- `extractCourseDetail(response)`
- `getToolErrors(response)`

These helpers follow `agent-client/backend-documentation.md` contracts:
- `get_course_recommendation`
- `get_course_detail`

## Exports

- Core: `@rizal_ncc/agent-client`
- React adapter: `@rizal_ncc/agent-client/react`
- Styles: `@rizal_ncc/agent-client/style.css`

## Development

```bash
npm install
npm run dev
npm test
npm run build
```

`npm run dev` starts a root-level Vite playground (`index.html` + `demo/*`) so you can test the wrapper without creating a nested project.

Playground API config:

```bash
# optional: defaults to http://ncc-stg.api.bawana:8000
export VITE_API_BASE_URL=http://ncc-stg.api.bawana:8000/api/

# or set in .env
export VITE_AI_AGENT_TOKEN=<access_token>
```

You can also set token in browser:

```js
localStorage.setItem("access_token", "<access_token>");
```
