import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["dist/**", "node_modules/**", "src/**/*.integration.test.ts"],
    coverage: { provider: "v8", reporter: ["text", "json"] },
  },
});
