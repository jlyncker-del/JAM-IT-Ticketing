import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (mode === "production" && !env.VITE_API_URL?.trim()) {
    throw new Error("VITE_API_URL fehlt. Setzen Sie die öffentliche Render-Backend-URL; /api/v1 wird bei Bedarf automatisch ergänzt.");
  }

  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173 },
    test: { environment: "jsdom", setupFiles: "./src/test/setup.ts" },
  };
});
