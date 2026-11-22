import { beforeEach, expect, test, vi } from "vitest";
import type { RemoteContractImplementation } from "@manuelselch/pi-sdk/plugins";
import { folderOpeningContract } from "../../index.js";
import { createFolderOpeningHost, DirectoryOperationError, type DirectoryBrowserService } from "../index.js";

let browse: ReturnType<typeof vi.fn<DirectoryBrowserService["browse"]>>;
let provider: RemoteContractImplementation<typeof folderOpeningContract>;

beforeEach(async () => {
  browse = vi.fn();
  const entry = createFolderOpeningHost({ browse });
  await entry.setup({
    signal: new AbortController().signal,
    onCleanup: vi.fn(),
    provide: vi.fn((_contract, implementation) => { provider = implementation; }),
  });
});

test("omits absent listing fields so root listings remain JSON-safe", async () => {
  browse.mockResolvedValue({ path: "/", parentPath: undefined, nextCursor: undefined, breadcrumbs: [], entries: [] });

  const result = await provider.browse({ path: "/" });

  expect(result).toEqual({ ok: true, listing: { path: "/", breadcrumbs: [], entries: [] } });
  expect(JSON.parse(JSON.stringify(result))).toEqual(result);
});

test("preserves actionable folder errors", async () => {
  browse.mockRejectedValue(new DirectoryOperationError("listingChanged", "Refresh to continue."));

  await expect(provider.browse({ path: "/" })).resolves.toEqual({ ok: false, error: { code: "listingChanged", message: "Refresh to continue." } });
});

test("sanitizes unexpected filesystem failures", async () => {
  browse.mockRejectedValue(new Error("secret filesystem internals"));

  await expect(provider.browse({ path: "/" })).resolves.toEqual({ ok: false, error: { code: "operationFailed", message: "Unable to read this server folder." } });
});
