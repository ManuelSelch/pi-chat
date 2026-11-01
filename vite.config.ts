import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { chatBuildIdentity } from "./src/shared/node/build-identity.js";
import { packageVersion } from "./src/shared/node/package-version.js";

// Kept in sync with the server's own PI_CHAT_PORT so a second instance can run
// alongside an existing one.
const serverPort = Number(process.env.PI_CHAT_PORT ?? 8788);

export default defineConfig({
  plugins: [tailwindcss(), react()],
  define: { __PI_CHAT_BUILD__: JSON.stringify({ chat: chatBuildIdentity(), sdk: packageVersion(import.meta.resolve("@manuelselch/pi-sdk")) }) },
  server: {
    host: "127.0.0.1",
    port: Number(process.env.PI_CHAT_WEB_PORT ?? 5173),
    proxy: {
      "/api/pi-chat/version": { target: `http://127.0.0.1:${serverPort}` },
      "/ws": {
        target: `ws://127.0.0.1:${serverPort}`,
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist/web",
    sourcemap: process.env.PI_CHAT_COVERAGE === "1",
    chunkSizeWarningLimit: 650,
  },
});
