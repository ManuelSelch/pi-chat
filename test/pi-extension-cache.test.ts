import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { invalidatePiExtensionCache } from "../src/server/pi-extension-cache.js";

it("loads changed extension code after invalidating the real SDK factory cache", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-chat-cache-"));
  const path = join(dir, "extension.ts");
  const sdkEntry = import.meta.resolve("@earendil-works/pi-coding-agent");
  const loader = await import(new URL("./core/extensions/loader.js", sdkEntry).href);
  const load = async () => {
    const result = await loader.loadExtensionsCached([path], dir);
    expect(result.errors).toEqual([]);
    return result.extensions[0].commands.get("cache-test").description;
  };
  try {
    await writeFile(path, 'export default pi => { pi.registerCommand("cache-test", { description: "before", handler: async () => {} }); }');
    expect(await load()).toBe("before");
    await writeFile(path, 'export default pi => { pi.registerCommand("cache-test", { description: "after", handler: async () => {} }); }');
    // Reproduce new-runtime creation reusing stale factories in the same cwd.
    expect(await load()).toBe("before");
    await invalidatePiExtensionCache();
    expect(await load()).toBe("after");
  } finally {
    await invalidatePiExtensionCache();
    await rm(dir, { recursive: true, force: true });
  }
});
