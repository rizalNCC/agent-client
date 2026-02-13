/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_AI_AGENT_TOKEN?: string;
  readonly VITE_AI_AGENT_AGENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
