# @rizal_ncc/agent-client

Frontend UI wrapper + typed helpers for `nems/ai_agent`.

`backend-documentation.md` is the source-of-truth contract for backend payload and `tool_results` schema.

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
      baseURL="https://api.example.com/api"
      accessToken="your-access-token-here"
      agent="home-assistant"
      primaryColor="#0f766e"
      primaryForeground="#ffffff"
      suggestedMessages={[
        "recommend leadership course",
        "recommend data analysis course"
      ]}
    />
  );
}
```

## Chat Component Props (AiAgentChat)

Common props:

- `baseURL: string` backend base URL
- `accessToken: string | () => string | Promise<string>` bearer token provider
- `agent?: string` default `home-assistant`
- `suggestedMessages?: string[]` clickable prompt chips
- `headerTitle?: string`
- `headerDescription?: string`
- `assistantAvatar?: ReactNode` custom avatar component slot
- `assistantAvatarUrl?: string` avatar URL override (default `/ai-img.svg`)
- `initials?: boolean` show/hide assistant and user initials (default `true`)
- `primaryColor?: string` theme color (default `#1168bb`)
- `primaryForeground?: string` text color on primary surfaces (default `#ffffff`)
- `metadata?: { course_id?: number }`
- `requestHeaders?: HeadersInit`

UX behavior:

- Composer uses one combined icon action button:
- idle state: send icon
- loading state: stop icon

Advanced:

- `generateResponse?: (request) => Promise<{ content: string }>` custom transport override
- `respondPath?: string` manual endpoint override
- `onMessage?`, `onError?`

Path behavior (built-in transport):

- If `baseURL` ends with `/api` -> uses `/v2/ai-agent/respond/`
- Otherwise -> uses `/api/v2/ai-agent/respond/`

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

Helpers for backend `tool_results`:

- `getToolResultsByName(response, toolName)`
- `extractRecommendationOutput(response)`
- `extractRecommendationItems(response)`
- `extractCourseDetail(response)`
- `getToolErrors(response)`

Tool names follow backend contracts:

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

`npm run dev` starts the root-level Vite playground (`index.html` + `demo/*`).

Demo env:

```bash
VITE_API_BASE_URL=http://ncc-stg.api.bawana:8000/api/
VITE_AI_AGENT_TOKEN=<access_token>
VITE_AI_AGENT_AGENT=home-assistant
```
