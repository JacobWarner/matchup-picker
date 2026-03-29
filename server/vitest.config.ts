import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/matchup.integration.test.ts", "**/node_modules/**"],
  },
});
