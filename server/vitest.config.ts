import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/champions.test.ts", "tests/parseUtils.test.ts"],
    exclude: ["**/*.integration.*", "**/node_modules/**"],
  },
});
