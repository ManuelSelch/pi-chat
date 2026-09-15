import { stripAnsi } from "./widget-registry.js";

/** A label an extension pinned, before the footer decides where to put it. */
export interface ExtensionStatus {
  key: string;
  text: string;
}

/**
 * Holds the `ctx.ui.setStatus` labels of one session.
 *
 * The terminal draws these in the bottom-left of its footer, and extensions
 * colour them through `ctx.ui.theme` — so the text arrives with escape
 * sequences the browser would otherwise show as literal garbage. The tone is
 * lost with them; the label itself is what carries the meaning.
 */
export class StatusRegistry {
  private readonly statuses = new Map<string, string>();

  constructor(private readonly onChange: (statuses: ExtensionStatus[]) => void) {}

  /**
   * `undefined` clears, per Pi's contract, and so does text that is only
   * colour: an extension that toggles a marker off by setting empty text means
   * "no status" rather than "an empty one". Unchanged text is dropped without an
   * event, because a status is re-set on every state change an extension
   * notices, most of which leave the label exactly as it was.
   */
  set(key: string, text: string | undefined): void {
    const next = text === undefined ? undefined : stripAnsi(text).trim();

    if (next === undefined || next.length === 0) {
      if (!this.statuses.delete(key)) return;
      this.onChange(this.list());
      return;
    }

    if (this.statuses.get(key) === next) return;
    this.statuses.set(key, next);
    this.onChange(this.list());
  }

  /**
   * Sorted by key, as the terminal footer sorts them: a label must not jump
   * around because an unrelated extension happened to set one first.
   */
  list(): ExtensionStatus[] {
    return [...this.statuses]
      .map(([key, text]) => ({ key, text }))
      .sort((left, right) => left.key.localeCompare(right.key));
  }

  /** A disposed session's labels must not outlive it on screen. */
  clear(): void {
    if (this.statuses.size === 0) return;
    this.statuses.clear();
    this.onChange(this.list());
  }
}
