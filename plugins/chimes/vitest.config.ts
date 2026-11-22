import { defineConfig, mergeConfig } from "vitest/config";
import defaults from "../../config/plugins/vitest.js";

export default mergeConfig(defaults, defineConfig({
  test: { setupFiles: ["src/web/__tests__/setup.ts"] },
}));
