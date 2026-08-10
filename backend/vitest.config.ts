import { defineConfig } from "vitest/config";

if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.UPLOAD_DIR = ".test-uploads";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 15_000,
    exclude: ["**/dist/**", "**/node_modules/**", "**/coverage/**"],
    coverage: { reporter: ["text", "html"] },
  },
});
