# AI Agent Backend (`nems/ai_agent`)

AI Agent is AGENTIC AI chat assistant backend module for NCC platform.

This module provides:

- AI response endpoint (`/api/v2/ai-agent/respond/`)
- health endpoint (`/api/v2/ai-agent/health/`)
- profile-based prompt and tool routing
- OpenAI Responses API integration with function-calling loop
- persistence for sessions/messages/metadata

This README is the source-of-truth API contract for backend and frontend integration.

## 1) Core Concepts

- `AiAgentConfig`: tenant-level AI defaults (model, prompt, limits, API key override).
- `AiAgentProfile`: agent persona/task profile (slug, profile prompt, allowed tools).
- `AiAgentTool`: central tool bank entry (OpenAI function schema + metadata).
- `AgentSession`: chat thread, now scoped by `user + company + profile + active`.
- `AgentMessage`: user/assistant/system message row.
- `AgentMetadata`: structured metadata (`system_prompt`, `context`, `model_usage`, `tool_call`, `error`).

## 2) Endpoints

## `POST /api/v2/ai-agent/respond/`

Authenticated endpoint for user message -> AI response.

### Request Body

```json
{
  "agent": "course-assistant",
  "message": "Rangkumin materi ini dong",
  "metadata": {
    "course_id": 28
  }
}
```

### Request Contract

- `agent`: optional string, max 100 chars.
  - When valid and active profile exists, backend uses profile prompt + profile tools.
  - If missing/unknown/inactive, backend falls back to config-only prompt and no profile tools.
- `message`: required non-empty string.
- `metadata`: optional JSON object.
  - Currently allowed key(s): `course_id` only.
  - Unknown keys are rejected with `400`.
  - `course_id` must be positive integer (`"28"` is normalized to `28`).
  - Payload size is limited by `AI_AGENT_METADATA_MAX_BYTES`.

### Success Response (`200`)

```json
{
  "session_id": 12,
  "user_message_id": 1001,
  "assistant_message_id": 1002,
  "message": "Berikut ringkasan materinya.",
  "model": "gpt-4o-mini",
  "response_id": "resp_xxx",
  "prompt": {
    "version": "v1",
    "hash": "..."
  },
  "tool_results": [
    {
      "id": "call_1",
      "name": "get_course_detail",
      "output": {
        "course": {
          "id": 28
        }
      }
    }
  ]
}
```

### Response Contract

- `session_id`: persisted chat session id.
- `user_message_id`: id of stored user message.
- `assistant_message_id`: id of stored assistant message.
- `message`: final natural-language assistant text.
- `model`: resolved model name used in request.
- `response_id`: OpenAI response id.
- `prompt.version`, `prompt.hash`: resolved prompt metadata for observability.
- `tool_results`: optional, included only if tools were executed.

## `GET /api/v2/ai-agent/health/`

Returns OpenAI/model readiness for current tenant.

### Success (`200`) or Unavailable (`503`)

```json
{
  "ok": true,
  "checked": true,
  "model": "gpt-4o-mini",
  "prompt": {
    "version": "v1",
    "hash": "..."
  },
  "feature_enabled": true,
  "model_id": "gpt-4o-mini"
}
```

`error` appears when health check fails.

## 3) Status Codes and Error Contract

`POST /respond/` can return:

- `200`: success.
- `400`: invalid payload (`message`, `metadata`, length, unknown metadata keys).
- `403`: feature flag `ai_agent_enabled` is disabled for tenant.
- `503`: API key missing or OpenAI/service failure.

Typical `400` payloads:

```json
{ "message": ["This field may not be blank."] }
```

```json
{ "metadata": ["Unknown metadata keys: foo."] }
```

Typical `503` payloads:

```json
{ "detail": "OPENAI_API_KEY is not configured." }
```

```json
{ "detail": "AI service is temporarily unavailable." }
```

## 4) Prompt and Profile Resolution

Final system prompt is composed as:

1. config prompt (`AiAgentConfig.system_prompt` or setting fallback)
2. profile prompt (if active profile found)
3. runtime context line (when `metadata.course_id` resolves to active tenant course)

Composition rule:

- If both config + profile exist:
  - `"<config>\n\nAgent profile task:\n<profile>"`
- If only one exists, use that one.

Runtime context line includes compact course snapshot fields (id/title/modality/tags/assets) and is appended to the final prompt.

## 5) Session Behavior (Important)

Active session lookup is profile-scoped:

- reuse by `user + company + profile + status=active`

Impact:

- `home-assistant` and `course-assistant` no longer share message history.
- profile switching creates/uses separate session threads.

If request has no resolved profile, session uses `profile = null` scope.

## 6) Tool Calling Behavior

Tools are taken from active profile (`AiAgentProfile.tools`) and filtered by registered backend handlers.

Flow:

1. send request to OpenAI Responses API with tool definitions
2. if function call appears:
   - validate args against schema
   - execute registered tool handler
   - append `function_call_output`
3. continue until no tool call or max iterations reached

Special rule:

- For `agent=course-assistant` with `metadata.course_id`, first tool choice is forced to `get_course_detail` when available.

Recommendation follow-up contract:

- If `get_course_recommendation` is called, backend injects post-tool instruction so assistant should return exactly one short sentence and not list/repeat courses from `tool_results`.

## 7) Tool Result Schemas (Frontend Contract)

`tool_results` shape:

```json
[
  {
    "id": "call_xxx",
    "name": "<tool_name>",
    "output": { "...": "..." }
  }
]
```

### `get_course_detail` output

```json
{
  "course": {
    "id": 28,
    "title": "Leadership Foundations",
    "description": "...",
    "modality": "Learn",
    "status": "Started",
    "content_in_sequence": false,
    "min_percentage_finish": 100,
    "tags": ["leadership", "communication"]
  }
}
```

Possible error output:

```json
{ "error": "course_id must be a positive integer." }
```

```json
{ "error": "Course with id=28 was not found." }
```

### `get_course_recommendation` output

```json
{
  "count": 43,
  "next": "http://.../api/v2/course-recommendations/?q=leadership&page=2&page_size=5",
  "previous": null,
  "results": [
    {
      "id": 885,
      "title": "Evaluasi Return on Investment",
      "description": "...",
      "url": "https://ncc-stg.bawana.com/courses/885",
      "type": "Course",
      "status": null,
      "progress": 0,
      "is_eligible": true,
      "in_playlist": false
    }
  ]
}
```

Notes:

- `next` and `previous` are pagination URLs from recommendation endpoint.
- `results` payload comes from `CourseRecommendationView` serializer.

## 8) Frontend Integration Guide

When integrating `POST /respond/`:

1. Always render `message` as assistant text.
2. If `tool_results` exists, parse by `name`.
3. For `get_course_recommendation`:
   - render course cards/list from `tool_results[*].output.results`
   - do not parse course items from `message`
   - treat `message` as short summary/intro only
4. Handle tool error outputs gracefully:
   - `tool_results[*].output.error`
5. Use `next` / `previous` from recommendation output for pagination UX.
6. Keep UI resilient when `tool_results` is absent (pure text answer flow).

Recommended UI behavior for recommendation requests:

- Primary content source: `tool_results`.
- Secondary narrative: `message` (one-sentence context).

## 9) Example Flows

### A) Course detail summarization

Request:

```json
{
  "agent": "course-assistant",
  "message": "Rangkumin materi ini dong",
  "metadata": { "course_id": 28 }
}
```

Expected behavior:

- backend enriches prompt with course runtime context
- backend may force initial tool call to `get_course_detail`
- response can contain `tool_results` with `course` snapshot

### B) Course recommendations

Request:

```json
{
  "agent": "home-assistant",
  "message": "Berikan saya rekomendasi course mengenai kepemimpinan",
  "metadata": {}
}
```

Expected behavior:

- backend executes `get_course_recommendation` if profile/tool prompt leads there
- `message` should be a short sentence
- recommendation list is in `tool_results`

## 10) Settings and Environment Variables

Main settings used:

- `OPENAI_API_KEY`
- `AI_AGENT_MODEL`
- `AI_AGENT_TEMPERATURE`
- `AI_AGENT_TOP_P`
- `AI_AGENT_MAX_OUTPUT_TOKENS`
- `AI_AGENT_TRUNCATION`
- `AI_AGENT_REQUEST_TIMEOUT`
- `AI_AGENT_PARALLEL_TOOL_CALLS`
- `AI_AGENT_MAX_TOOL_ITERATIONS`
- `AI_AGENT_MAX_INPUT_CHARS`
- `AI_AGENT_HISTORY_MAX_MESSAGES`
- `AI_AGENT_HISTORY_MAX_CHARS`
- `AI_AGENT_SAFETY_SALT`
- `AI_AGENT_SYSTEM_PROMPT`
- `AI_AGENT_SYSTEM_PROMPT_VERSION`
- `AI_AGENT_METADATA_MAX_BYTES`

Tenant overrides via `AiAgentConfig`:

- api key, model/runtime values, system prompt, history/input limits.

## 11) Seeding and Operations

### Seed tool bank (`seed_ai_agent_tools`)

List available tool names:

```bash
docker-compose -f local.yml run --rm django python manage.py seed_ai_agent_tools --list
```

Seed all tools from catalog:

```bash
docker-compose -f local.yml run --rm django python manage.py seed_ai_agent_tools
```

Seed specific tool(s):

```bash
docker-compose -f local.yml run --rm django python manage.py seed_ai_agent_tools --tool get_course_detail

docker-compose -f local.yml run --rm django python manage.py seed_ai_agent_tools --tool get_course_recommendation
```

### Seed profiles (`seed_ai_agent_profiles`)

Seed one company:

```bash
docker-compose -f local.yml run --rm django python manage.py seed_ai_agent_profiles --company-id 1
```

Seed multiple companies:

```bash
docker-compose -f local.yml run --rm django python manage.py seed_ai_agent_profiles --company-id 1 --company-id 2
```

Seed all companies:

```bash
docker-compose -f local.yml run --rm django python manage.py seed_ai_agent_profiles --all-companies
```

What this command does:

- upserts required tools in tool bank:
  - `get_course_detail`
  - `get_course_recommendation`
- upserts profiles per target company:
  - `home-assistant`
  - `course-assistant`
- binds profile tools:
  - `home-assistant` -> `get_course_recommendation`
  - `course-assistant` -> `get_course_detail`

### Seed config (`seed_ai_agent_configs`)

Seed one company:

```bash
docker-compose -f local.yml run --rm django python manage.py seed_ai_agent_configs --company-id 1
```

Seed multiple companies:

```bash
docker-compose -f local.yml run --rm django python manage.py seed_ai_agent_configs --company-id 1 --company-id 2
```

Seed all companies:

```bash
docker-compose -f local.yml run --rm django python manage.py seed_ai_agent_configs --all-companies
```

Force overwrite existing populated fields (except `api_key`):

```bash
docker-compose -f local.yml run --rm django python manage.py seed_ai_agent_configs --all-companies --overwrite
```

What this command seeds:

- model/runtime defaults from settings
- prompt version from settings
- global persona prompt (`CONFIG_SYSTEM_PROMPT`)
- input/history/safety limits

Behavior notes:

- without `--overwrite`: only empty fields are filled
- with `--overwrite`: populated fields are replaced (except `api_key`)

### Apply migrations

```bash
docker-compose -f local.yml run --rm django python manage.py migrate ai_agent --settings=config.settings.local
```

### Run ai_agent tests only

```bash
docker-compose -f local.yml run --rm --no-deps django sh -lc 'PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest -q --assert=plain -p pytest_django.plugin -o addopts="" nems/ai_agent/tests --ds=config.settings.local --nomigrations --reuse-db'
```

### Reset data to zero rows (development only)

Delete runtime chat data only (`AgentSession`, `AgentMessage`, `AgentMetadata`) for all companies:

```bash
docker-compose -f local.yml run --rm django python manage.py shell -c "from nems.ai_agent.models import AgentSession, AgentMessage, AgentMetadata; AgentMetadata.all_objects.all().delete(); AgentMessage.all_objects.all().delete(); AgentSession.all_objects.all().delete(); print('ai_agent runtime tables cleared')"
```

Delete all ai_agent tables data (including config/profile/tool bank), for full re-seed:

```bash
docker-compose -f local.yml run --rm django python manage.py shell -c "from nems.ai_agent.models import AgentSession, AgentMessage, AgentMetadata, AiAgentProfile, AiAgentTool, AiAgentConfig; AgentMetadata.all_objects.all().delete(); AgentMessage.all_objects.all().delete(); AgentSession.all_objects.all().delete(); AiAgentProfile.objects.all().delete(); AiAgentTool.objects.all().delete(); AiAgentConfig.objects.all().delete(); print('all ai_agent tables cleared')"
```

Note:

- These commands are destructive and intended for local/dev usage.
- After full wipe, run seed commands again (`seed_ai_agent_tools`, `seed_ai_agent_profiles`, `seed_ai_agent_configs`).

## 12) Troubleshooting

- `tool_results` not present:
  - check `agent` slug matches active profile
  - verify profile has active tools assigned
  - verify tool name is registered in backend (`tools.py`)
- recommendation list appears in `message`:
  - check profile prompt quality in DB
  - backend already adds post-tool one-sentence contract for recommendation tool calls
- `503` errors:
  - verify tenant/global API key
  - verify model availability via `/ai-agent/health/`

## 13) Code References

- Routes: `config/api_router_version_2.py`
- API view: `nems/ai_agent/api/views.py`
- Serializer contract: `nems/ai_agent/api/serializers.py`
- OpenAI integration: `nems/ai_agent/openai_service.py`
- Tool handlers: `nems/ai_agent/tools.py`
- Tool catalog: `nems/ai_agent/tool_catalog.py`
- Models: `nems/ai_agent/models.py`
- Tests: `nems/ai_agent/tests/`
