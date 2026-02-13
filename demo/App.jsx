import { AiAgentChat } from "../src/react";

function readEnv(name) {
  const value = import.meta.env[name];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  throw new Error(`Missing ${name} in .env`);
}

const BASE_URL = readEnv("VITE_API_BASE_URL").replace(/\/+$/, "");
const ACCESS_TOKEN = readEnv("VITE_AI_AGENT_TOKEN");
const AGENT = readEnv("VITE_AI_AGENT_AGENT");

export default function App() {
  return (
    <main className="playground">
      <header className="playground__header">
        <h1>Agent Client Playground</h1>
        <p>
          <strong>Base URL:</strong> <code>{BASE_URL}</code>
          <br />
          <strong>Agent:</strong> <code>{AGENT}</code>
        </p>
      </header>

      <AiAgentChat
        baseURL={BASE_URL}
        accessToken={ACCESS_TOKEN}
        agent={AGENT}
        suggestedMessages={[
          "recommend leadership course",
          "recommend data analysis course",
          "recommend communication course"
        ]}
      />
    </main>
  );
}
