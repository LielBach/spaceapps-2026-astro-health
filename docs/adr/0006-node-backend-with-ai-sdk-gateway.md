# Node back end with the AI SDK as the LLM gateway

The app is a TypeScript and React front end with a small Node back end. The back end keeps the LLM key out of the browser and writes the event log. All LLM calls go through the Vercel AI SDK, so the provider is one config value: Claude in milestone 1, an open-weights model served by Ollama on a MacBook in milestone 2. We considered LiteLLM, but it is Python: it would need a second process or a Python back end. We chose one language and one process.
