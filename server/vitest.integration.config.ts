import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/matchup.integration.test.js"],
    testTimeout: 30000,
  },
});
