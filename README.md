[![Node.js Package](https://github.com/rizalNCC/agent-client/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/rizalNCC/agent-client/actions/workflows/npm-publish.yml)

# @rizal_ncc/agent-client

Frontend UI wrapper + typed helpers for `nems/ai_agent`.

`backend-documentation.md` is the source-of-truth contract for backend payload and `tool_results` schema.

## Table of Contents

- [Install](#install)
- [Quick Start (React)](#quick-start-react)
- [Layouts](#layouts)
- [AiAgentChat Props](#aiagentchat-props)
- [Built-in Transport Contract](#built-in-transport-contract)
- [Headless Core Usage](#headless-core-usage)
- [Tool Result Helpers](#tool-result-helpers)
- [Theme and Styling](#theme-and-styling)
- [Architecture](#architecture)
- [Testing](#testing)
- [Development](#development)
- [Release and Publish](#release-and-publish)
- [File Map](#file-map)
- [Known Tradeoffs](#known-tradeoffs)

## Install

```bash
npm install @rizal_ncc/agent-client
```

## Quick Start (React)

```tsx
import { AiAgentChat } from "@rizal_ncc/agent-client/react";
import "@rizal_ncc/agent-client/style.css";

export function App() {
  return (
    <AiAgentChat
      baseURL="https://example.com/api"
      accessToken="your-access-token"
      agent="home-assistant"
      primaryColor="#0f766e"
      primaryForeground="#ffffff"
      suggestedMessages={[
        "recommend leadership course",
        "recommend data analysis course",
      ]}
    />
  );
}
```

## Layouts

The component supports three layouts:

- `inline`: always open in page flow.
- `floating`: fixed toggle button + popover panel.
- `dropdown`: inline toggle bar + expandable panel.

Examples:

```tsx
<AiAgentChat layout="inline" />
<AiAgentChat layout="floating" defaultOpen={false} />
<AiAgentChat layout="dropdown" defaultOpen={false} panelHeight="560px" />
```

Open state control:

- Controlled: pass `open` + `onOpenChange`.
- Uncontrolled: pass `defaultOpen`.

## AiAgentChat Props

### Core

- `baseURL?: string` backend base URL (required for built-in transport)
- `accessToken?: string | () => string | undefined | Promise<string | undefined>` bearer token provider (required for built-in transport)
- `agent?: string` default `home-assistant`
- `metadata?: { course_id?: number }`
- `requestHeaders?: HeadersInit`
- `respondPath?: string` endpoint override
- `generateResponse?: (request) => Promise<{ content: string }>` custom transport override

### UI

- `headerTitle?: string`
- `headerDescription?: string`
- `suggestedMessages?: string[]`
- `assistantAvatar?: ReactNode`
- `assistantAvatarUrl?: string` default `/ai-img.svg`
- `assistantInitials?: string` default `AI`
- `userInitials?: string` default `YOU`
- `initials?: boolean` default `true`
- `placeholder?: string` default `Ask the assistant...`
- `sendLabel?: string` default `Send`
- `stopLabel?: string` default `Stop`
- `className?: string`

### Theme

- `primaryColor?: string` default `#1168bb`
- `primaryForeground?: string` default `#ffffff`
- `panelHeight?: string` optional CSS height override (uses CSS variable fallback if omitted)
- `zIndex?: number` default `60`

### Layout control

- `layout?: "inline" | "floating" | "dropdown"` default `inline`
- `open?: boolean`
- `defaultOpen?: boolean`
- `onOpenChange?: (open: boolean) => void`
- `floatingPosition?: "bottom-right" | "bottom-left"` default `bottom-right`
- `openLabel?: string` default `Open chat`
- `closeLabel?: string` default `Close chat`

### Events

- `onMessage?: (message, messages) => void`
- `onError?: (error, messages) => void`

## Built-in Transport Contract

If `generateResponse` is not provided, `AiAgentChat` performs backend requests.

Path resolution:

- if `baseURL` ends with `/api` -> `POST /v2/ai-agent/respond/`
- otherwise -> `POST /api/v2/ai-agent/respond/`

Request body:

- `agent`
- `message` (latest user message)
- `metadata`

Expected response shape (minimum):

- `message: string`
- `tool_results?: ToolResult[]`

Recommendation behavior:

- Renders `get_course_recommendation` results as horizontal cards.
- Uses `next` for pagination when available.
- `Load more` appends validated incoming items.
- Duplicate items are currently allowed by design.

## Headless Core Usage

```ts
import { ChatbotCore } from "@rizal_ncc/agent-client";

const bot = new ChatbotCore({
  generateResponse: async () => ({ content: "Hello" }),
});

await bot.sendMessage("Hi");
console.log(bot.getState().messages);
```

`ChatbotCore` notes:

- Ignores empty messages.
- Aborts previous in-flight request on new send.
- Throws if `generateResponse` returns empty `content`.
- Exposes `stop()` for manual cancellation.

## Tool Result Helpers

Helpers exported from core entry:

- `getToolResultsByName(response, toolName)`
- `getToolErrors(response)`
- `extractCourseDetail(response)`
- `extractRecommendationOutput(response)`
- `extractRecommendationItems(response)`

Known backend tool names:

- `get_course_recommendation`
- `get_course_detail`

## Theme and Styling

Import styles once:

```tsx
import "@rizal_ncc/agent-client/style.css";
```

Runtime CSS variables used by component shell:

- `--chat-primary`
- `--chat-primary-rgb`
- `--chat-primary-foreground`
- `--chat-panel-height`
- `--chat-shell-z-index`

Important:

- Do not redeclare `--chat-primary*` inside `.ai-agent-chat` if you want prop colors to apply.

## Architecture

Primary layers:

1. `ChatbotCore` state engine (`src/core/chatbot.ts`)
2. React adapter + transport + layout shell (`src/adapters/react.tsx`)
3. Tool parsing and pagination helpers (`src/lib/tool-results.ts`, `src/lib/recommendation-pagination.ts`)
4. UI styles and layout animations (`src/style.css`)

Message lifecycle:

1. User input -> user message append (`isLoading = true`)
2. Transport call (custom or built-in)
3. Assistant message normalize + append
4. Optional recommendation pagination update
5. `isLoading = false`

## Testing

Stack:

- Vitest
- React Testing Library
- jsdom

Current coverage includes:

- core behavior/error flow
- tool helper parsing
- recommendation merge behavior
- dropdown/floating open state
- typing/stop/error UI states
- load-more append flow

Run tests:

```bash
npm test
```

## Development

```bash
npm install
npm run dev
npm test
npm run build
```

`npm run dev` starts Vite playground (`index.html` + `demo/*`).

Demo env (`.env`):

```bash
VITE_API_BASE_URL=http://example.com/
VITE_AI_AGENT_TOKEN=<access_token>
VITE_AI_AGENT_AGENT=home-assistant
```

## Release and Publish

Pre-release validation:

```bash
npm run release:check
```

Manual publish:

```bash
npm publish --access public
```

Automated publish (GitHub Actions):

- Workflow: `.github/workflows/npm-publish.yml`
- Trigger: push tag matching `v*.*.*`
- Required secret: `NPM_TOKEN` (npm automation token)

Tag-based release flow:

```bash
npm version patch
git push --follow-tags
```

Use `minor` or `major` instead of `patch` when needed.

## File Map

- Core
  - `src/core/chatbot.ts`
  - `src/core/types.ts`
  - `src/core/errors.ts`
- React
  - `src/adapters/react.tsx`
  - `src/react.ts`
- Helpers
  - `src/lib/tool-results.ts`
  - `src/lib/recommendation-pagination.ts`
- Styles
  - `src/style.css`
- Tests
  - `tests/chatbot-core.test.ts`
  - `tests/tool-results.test.ts`
  - `tests/recommendation-pagination.test.ts`
  - `tests/ai-agent-chat-ui.test.tsx`

## Known Tradeoffs

1. Recommendation dedupe is intentionally disabled.
2. Built-in transport assumes JSON response (`response.json()`).
3. Some layout behavior depends on CSS class contracts.
4. Token refresh strategy is caller-managed when using function token provider.
