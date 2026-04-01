import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/ugg.integration.test.ts", "tests/matchup.integration.test.ts"],
    testTimeout: 30000,
  },
});
