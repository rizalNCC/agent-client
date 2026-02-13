import { AiAgentChat } from "../src/react";

function readEnv(name) {
  const value = import.meta.env[name];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  throw new Error(`Missing ${name} in .env`);
}

function resolveApiConfig() {
  return {
    baseURL: readEnv("VITE_API_BASE_URL").replace(/\/+$/, ""),
    respondPath: "/v2/ai-agent/respond/",
    agent:
      typeof import.meta.env.VITE_AI_AGENT_AGENT === "string" &&
      import.meta.env.VITE_AI_AGENT_AGENT.trim()
        ? import.meta.env.VITE_AI_AGENT_AGENT.trim()
        : "home-assistant"
  };
}

export default function App() {
  const apiConfig = resolveApiConfig();

  return (
    <main className="playground">
      <header className="playground__header">
        <h1>Agent Client Playground</h1>
        <p>
          Frontend-only wrapper demo calling <code>ncc-stg.api.bawana:8000</code> using
          <code> baseURL + accessToken</code>.
        </p>
        <p>
          <strong>Base URL:</strong> <code>{apiConfig.baseURL}</code> | <strong>Agent:</strong>{" "}
          <code>{apiConfig.agent}</code> | <strong>Token:</strong> <code>from .env</code>
        </p>
      </header>

      <AiAgentChat
        baseURL={apiConfig.baseURL}
        respondPath={apiConfig.respondPath}
        accessToken={readEnv("VITE_AI_AGENT_TOKEN")}
        agent={apiConfig.agent}
        initialMessages={[
          {
            id: "assistant_welcome",
            role: "assistant",
            content: "Hi! Ask me for course recommendations.",
            createdAt: new Date().toISOString()
          }
        ]}
      />
    </main>
  );
}
