/**
 * Pi 0.85 caches extension factories across resource-loader instances. A new
 * loader's first reload does not invalidate them. The SDK does not re-export
 * its invalidator, so isolate this version-specific bridge here, resolving
 * relative to the installed SDK (never a hardcoded node_modules location).
 * Failure must abort /reload rather than claim stale code was refreshed.
 */
export async function invalidatePiExtensionCache(): Promise<void> {
  const sdkEntry = import.meta.resolve("@earendil-works/pi-coding-agent");
  const loaderUrl = new URL("./core/extensions/loader.js", sdkEntry);
  const loader = await import(loaderUrl.href) as { clearExtensionCache?: () => void };
  if (typeof loader.clearExtensionCache !== "function") {
    throw new Error("This Pi SDK does not expose extension cache invalidation; restart the server to reload extensions.");
  }
  loader.clearExtensionCache();
}
