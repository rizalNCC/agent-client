# Playground

Local playground to test `@rizal_ncc/agent-client` against a real `ai_agent` backend.

## Setup

```bash
cd /Users/netpolitan/Dev/agent-client/playground
cp .env.example .env
npm install
```

## Run

```bash
npm start
npm run recommend -- --message "rekomendasi course leadership"
npm run detail -- --course-id 28
npm run ui
```

Run with CLI overrides (without editing `.env`):

```bash
npm start -- --message "rekomendasi course data analysis"
npm start -- --agent course-assistant --message "rangkumin materi ini dong" --course-id 28
npm start -- --json --message "rekomendasi course data analysis"
```

## Important env vars

- `AI_AGENT_BASE_URL`: backend base URL (example: `http://localhost:8000/api/v2`)
- `AI_AGENT_TOKEN`: bearer token (optional if endpoint is public)
- `AI_AGENT_AGENT`: agent name (default: `home-assistant`)
- `AI_AGENT_MESSAGE`: input message sent to `respond`
- `AI_AGENT_METADATA_JSON`: JSON metadata (example: `{"course_id":28}`)
- `AI_AGENT_CHECK_HEALTH`: `1` to run health check before respond
- `AI_AGENT_PREFER_TOOL_RESULTS`: `1` (default) to keep display message short when recommendations exist
- `AI_AGENT_WRITE_RAW_RESPONSE`: `1` (default) to save full API response into file
- `AI_AGENT_RAW_RESPONSE_PATH`: output file path for raw response JSON

The script prints:
- display message (optimized for UI when recommendation `tool_results` exists)
- raw AI message (only when display message was normalized)
- prompt info
- tool result summary
- extracted recommendation items or course detail (if available)
- raw response file location

`--json` mode prints one JSON object for easy automation/parsing.

## Sample UI

Run:

```bash
npm run ui
```

Open: `http://localhost:4173`

Notes:
- UI uses a local server-side proxy (`/api/respond`) that calls ai_agent via SDK.
- No backend changes are required.
