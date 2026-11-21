/**
 * Escape already has owners: Mantine closes an open modal or drawer with it,
 * and the composer uses it to dismiss the slash-command menu. Stopping the run
 * is only the fallback, so the precedence is decided here rather than being
 * implied by listener order.
 */
export function escapeIntent(context: { overlayOpen: boolean; menuOpen: boolean; busy: boolean }): "ignore" | "abort" {
  if (context.overlayOpen || context.menuOpen) return "ignore";
  return context.busy ? "abort" : "ignore";
}

/**
 * Ctrl+C clears the composer, matching the Pi CLI. On macOS the combination is
 * free, but on Windows and Linux it is Copy, so an active selection wins.
 */
export function clearInputIntent(context: { hasSelection: boolean; input: string }): "ignore" | "clear" {
  if (context.hasSelection || context.input.length === 0) return "ignore";
  return "clear";
}
