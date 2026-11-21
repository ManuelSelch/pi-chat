import { defineConfig } from "vitest/config";
export default defineConfig({ test: { setupFiles: ["test/setup.ts"], include: ["test/**/*.test.ts", "test/infra-tests/*.test.js"], coverage: { provider: "v8", reporter: ["text", "lcov"], include: ["src/**/*.ts"] } } });
