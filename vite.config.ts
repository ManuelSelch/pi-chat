import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Kept in sync with the server's own PI_CHAT_PORT so a second instance can run
// alongside an existing one.
const serverPort = Number(process.env.PI_CHAT_PORT ?? 8788);

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    host: "127.0.0.1",
    port: Number(process.env.PI_CHAT_WEB_PORT ?? 5173),
    proxy: {
      "/ws": {
        target: `ws://127.0.0.1:${serverPort}`,
        ws: true,
      },
    },
  },
  build: { outDir: "dist/web" },
});
