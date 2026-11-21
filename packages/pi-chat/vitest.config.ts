import { defineConfig } from "vitest/config";

export default defineConfig({
  define: { __PI_CHAT_BUILD__: JSON.stringify({ chat: "dev", sdk: "test-sdk" }) },
  test: {
    setupFiles: ["testing/setup.ts"],
    // Workspace symlinks must retain the installed-package boundary: Chat's
    // module mocks must not rewrite SDK/Server implementation dependencies.
    server: { deps: { external: [/\/packages\/pi-server\/dist\//, /\/packages\/pi-sdk-typescript\/dist\//] } },
    exclude: ["**/node_modules/**", "testing/e2e/**", "mockups/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts", "**/__test__/**"],
    },
  },
});
