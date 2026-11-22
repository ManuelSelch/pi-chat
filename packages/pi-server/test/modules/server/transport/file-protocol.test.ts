import { afterEach, expect, it } from "vitest";
import { createPiServer, type PiServer } from "../../../../src/index.js";
import { createFileOpeningPlugin, fileOpeningContract } from "@manuelselch/pi-plugin-file-opening/host";
import { folderOpeningPlugin, folderOpeningContract } from "@manuelselch/pi-plugin-folder-opening/host";
import { v2Socket } from "../../../infra/v2-socket.js";

let server: PiServer | undefined;
afterEach(async () => { await server?.close(); });

it.each([false, true])("rejects removed wire operations even when plugins are installed (%s)", async installed => {
  server = await createPiServer({
    plugins: installed ? services => [createFileOpeningPlugin(services), folderOpeningPlugin] : [],
    pluginRpcContracts: installed ? [fileOpeningContract, folderOpeningContract] : [],
    catalogue: { homeDirectory: null, lister: { listAll: async () => [] } },
  });
  await new Promise<void>(resolve => server!.httpServer.listen(0, "127.0.0.1", resolve));
  const client = await v2Socket(server);
  const initial = await client.initialize();
  expect(initial.capabilities).not.toContain("file.open");
  expect(initial.capabilities).not.toContain("directory.browse");

  for (const method of ["file.open", "directory.browse"]) {
    client.send(method, method, { path: "/" });
    expect(await client.response(method)).toMatchObject({ ok: false, error: { code: "unsupportedOperation" } });
  }
  if (!installed) {
    for (const contract of [fileOpeningContract, folderOpeningContract]) {
      client.send("plugin.call", contract.id, { contractId: contract.id, contractVersion: 1, method: contract.id === "file-opening" ? "open" : "browse", input: {} });
      expect(await client.response(contract.id)).toMatchObject({ ok: false, error: { code: "unsupportedOperation" } });
    }
  }
  client.send("server.ping", "ping");
  expect(await client.response("ping")).toMatchObject({ ok: true });
});
