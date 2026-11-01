import { defineConfig } from "vitest/config";

export default defineConfig({
  define: { __PI_CHAT_BUILD__: JSON.stringify({ chat: "dev", sdk: "test-sdk" }) },
  test: {
    setupFiles: ["test/setup.ts"],
    exclude: ["**/node_modules/**", "test/e2e/**", "packages/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts"],
    },
  },
});
