import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["test/setup.ts"],
    exclude: ["**/node_modules/**", "test/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts"],
    },
  },
});
