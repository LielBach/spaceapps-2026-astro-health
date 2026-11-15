import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.ts";
import { checkOllama, configFromEnv, reasonerFromConfig } from "./llm.ts";

// Keys stay in the repo-root .env (git-ignored), never in the browser (ADR 0006).
const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const config = configFromEnv();
const llm = reasonerFromConfig(config);
console.log(
  llm.primary
    ? `Clinical reasoner: ${llm.primary.info.provider} ${llm.primary.info.model ?? ""}` +
        (config.provider === "anthropic" ? ` (effort ${config.effort})` : "")
    : "Clinical reasoner: none (no-LLM fallback). Set ANTHROPIC_API_KEY in .env to use Claude.",
);
console.log(
  llm.offline
    ? `Offline model (comm blackout): ollama ${llm.offline.info.model} at ${config.ollamaBaseUrl}`
    : "Offline model: none. A comm blackout uses the no-LLM fallback. Set OFFLINE_LLM_MODEL to add one.",
);
if (llm.offline) console.log(await checkOllama(config));

const port = Number(process.env.PORT ?? 3001);
const app = buildApp({ clock: true, llm });

app.listen({ port, host: "127.0.0.1" }).then(
  (address) => console.log(`ORBIVIT server listening on ${address}`),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
