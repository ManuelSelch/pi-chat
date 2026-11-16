import assert from "node:assert/strict";
import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";

/** Changes a title through the same extension API used by title generators. */
export class SessionTitleFixture {
  private readonly setters = new Set<(title: string) => void>();
  readonly extension: ExtensionFactory = pi => {
    const setTitle = (title: string) => pi.setSessionName(title);
    pi.on("session_start", () => { this.setters.add(setTitle); });
    pi.on("session_shutdown", () => { this.setters.delete(setTitle); });
  };

  setTitle(title: string): void {
    assert.equal(this.setters.size, 1, "Title fixture requires one live session");
    [...this.setters][0]!(title);
  }
}
