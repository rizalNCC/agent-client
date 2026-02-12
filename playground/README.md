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
```

## Important env vars

- `AI_AGENT_BASE_URL`: backend base URL (example: `http://localhost:8000/api/v2`)
- `AI_AGENT_TOKEN`: bearer token (optional if endpoint is public)
- `AI_AGENT_AGENT`: agent name (default: `home-assistant`)
- `AI_AGENT_MESSAGE`: input message sent to `respond`
- `AI_AGENT_METADATA_JSON`: JSON metadata (example: `{"course_id":28}`)
- `AI_AGENT_CHECK_HEALTH`: `1` to run health check before respond

The script prints:
- AI summary message (`response.message`)
- prompt info
- tool result summary
- extracted recommendation items or course detail (if available)
