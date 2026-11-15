import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// API_PORT and WEB_PORT let a second checkout run next to the first (defaults 3001 and 5173).
const apiPort = process.env.API_PORT ?? "3001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
  },
});
