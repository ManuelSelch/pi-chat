import { defineConfig } from "vitest/config";

export default defineConfig({
  define: { __PI_CHAT_BUILD__: JSON.stringify({ chat: "dev", sdk: "test-sdk" }) },
  test: {
    setupFiles: ["testing/setup.ts"],
    // Workspace symlinks must retain the installed-package boundary: Chat's
    // module mocks must not rewrite SDK/Server implementation dependencies.
    server: { deps: { external: [/\/packages\/pi-server\/dist\//, /\/packages\/pi-sdk-typescript\/dist\//] } },
    exclude: ["**/node_modules/**", "testing/e2e/**", "mockups/**"],
    projects: [
      {
        extends: true,
        resolve: { conditions: ["browser"] },
        ssr: { resolve: { conditions: ["browser"] } },
        test: {
          name: "web",
          include: ["src/web/**/*.test.{ts,tsx}"],
          server: { deps: { inline: [/@manuelselch\/pi-plugin-folder-opening/] } },
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          exclude: ["**/node_modules/**", "testing/e2e/**", "mockups/**", "src/web/**"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts", "**/__test__/**"],
    },
  },
});
