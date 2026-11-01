import { createServer } from "node:http";
import { afterEach, expect, it } from "vitest";
import { installVersionRoute } from "../../../src/host/version-route.js";

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => { await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve())))); servers.length = 0; });

it("serves captured runtime versions without caching and preserves other routes", async () => {
  const server = createServer((_request, response) => { response.end("original"); });
  servers.push(server);
  installVersionRoute(server, "0.2.0");
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing port");
  const base = `http://127.0.0.1:${address.port}`;

  const response = await fetch(`${base}/api/pi-chat/version`);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ server: "0.2.0" });
  expect(await (await fetch(`${base}/health`)).text()).toBe("original");
});
