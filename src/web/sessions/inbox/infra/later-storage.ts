import type { LaterEntry } from "../domain/inbox-model.js";

export const laterStorageKey = (endpoint: string) => `pi-chat:later:${new URL(endpoint).href}`;

export function loadLater(endpoint: string, storage: Pick<Storage, "getItem"> = window.localStorage): LaterEntry[] {
  try {
    const raw = storage.getItem(laterStorageKey(endpoint));
    if (raw === null) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || !value.every((entry: unknown) => {
      if (!entry || typeof entry !== "object") return false;
      return "path" in entry && typeof entry.path === "string" && entry.path.length > 0 && "phase" in entry && (entry.phase === "parking" || entry.phase === "parked");
    })) throw new Error("Invalid membership");
    return [...new Map((value as LaterEntry[]).map(entry => [entry.path, entry])).values()];
  } catch {
    throw new Error("Could not read Later in this browser. Saved membership has not been changed.");
  }
}

export function saveLater(endpoint: string, entries: readonly LaterEntry[], storage: Pick<Storage, "setItem"> = window.localStorage): void {
  try { storage.setItem(laterStorageKey(endpoint), JSON.stringify(entries)); }
  catch { throw new Error("Could not save Later in this browser. The session has not been durably parked."); }
}
