import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.ts";
import { configFromEnv, reasonerFromConfig } from "./llm.ts";

// Keys stay in the repo-root .env (git-ignored), never in the browser (ADR 0006).
const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const config = configFromEnv();
const llm = reasonerFromConfig(config);
console.log(
  llm
    ? `Clinical reasoner: ${config.provider} deployment ${config.model}${config.effort ? ` (reasoning effort ${config.effort})` : ""}`
    : "Clinical reasoner: none (no-LLM fallback). Set AZURE_API_KEY, AZURE_RESOURCE_NAME and LLM_MODEL in .env to use Azure OpenAI.",
);

const port = Number(process.env.PORT ?? 3001);
const app = buildApp({ clock: true, llm });

app.listen({ port, host: "127.0.0.1" }).then(
  (address) => console.log(`AstroHealth server listening on ${address}`),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
