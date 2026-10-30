import { useEffect, useMemo, useRef, useState } from "react";
import type { AppState } from "../../../app/state/app-state.js";
import { hasSavedSession, historyRows, reconcileLater, type LaterEntry } from "../domain/inbox-model.js";
import { loadLater, saveLater } from "../infra/later-storage.js";

interface InboxOperations {
  close(id: string): Promise<void>;
  open(path: string): Promise<string>;
  archive(path: string, archived: boolean): Promise<void>;
  focus(id: string): void;
}
const errorText = (cause: unknown) => cause && typeof cause === "object" && "message" in cause ? String(cause.message) : String(cause);
const unknownOutcome = (cause: unknown) => cause !== null && typeof cause === "object" && "outcome" in cause && cause.outcome === "unknown";

/** Browser membership only. PiClient remains the authoritative runtime owner. */
export function useInboxLifecycle(app: AppState, endpoint: string, operations: InboxOperations) {
  const [initial] = useState(() => {
    try { return { entries: loadLater(endpoint), error: undefined as string | undefined, readable: true }; }
    catch (cause) { return { entries: [] as LaterEntry[], error: errorText(cause), readable: false }; }
  });
  const [entries, setEntries] = useState(initial.entries);
  const entriesRef = useRef(entries);
  const [error, setError] = useState(initial.error);
  const [pending, setPending] = useState(false);
  const locked = useRef(false);
  const uncertain = useRef(false);
  const waitForTabs = useRef<AppState["tabs"] | undefined>(undefined);
  const latest = useRef({ app, operations });
  latest.current = { app, operations };

  function persist(next: LaterEntry[]) {
    if (!initial.readable) throw new Error(initial.error);
    saveLater(endpoint, next);
    entriesRef.current = next;
    setEntries(next);
  }
  // Do not reconcile a command against inventory from before its result. New
  // authoritative inventory/catalogue/connection updates resolve uncertainty.
  useEffect(() => {
    if (app.connection !== "open" || !app.tabsKnown || !app.catalogueKnown || locked.current || !initial.readable) return;
    if (waitForTabs.current === app.tabs) return;
    waitForTabs.current = undefined;
    uncertain.current = false;
    const closing = new Set(app.sdkInventory.filter(tab => tab.status === "closing").flatMap(tab => tab.sessionPath ? [tab.sessionPath] : []));
    const next = reconcileLater(entriesRef.current, app.tabs, app.catalogue, closing);
    if (JSON.stringify(next) === JSON.stringify(entriesRef.current)) return;
    try { persist(next); uncertain.current = false; }
    catch (cause) { setError(errorText(cause)); }
  }, [app.sdkInventory, app.tabs, app.catalogue, app.connection, app.tabsKnown, app.catalogueKnown, pending]);

  async function run(operation: () => Promise<void>) {
    if (locked.current || uncertain.current || latest.current.app.connection !== "open") return;
    locked.current = true; setPending(true); setError(undefined);
    try { await operation(); }
    catch (cause) {
      setError(unknownOutcome(cause) ? `${errorText(cause)} The server outcome is unknown; reload to reconcile. No retry was sent.` : errorText(cause));
    }
    finally { locked.current = false; setPending(false); }
  }

  const select = (path: string) => run(async () => {
    const tab = latest.current.app.tabs.find(tab => tab.sessionPath === path);
    if (tab) { latest.current.operations.focus(tab.sessionId); return; }
    if (!hasSavedSession(latest.current.app.catalogue, path)) return;
    const id = await latest.current.operations.open(path);
    latest.current.operations.focus(id);
  });

  const park = (target: string) => run(async () => {
    const tab = latest.current.app.tabs.find(tab => tab.sessionId === target || tab.sessionPath === target);
    const path = tab?.sessionPath ?? target;
    if ((tab && tab.status !== "idle") || !hasSavedSession(latest.current.app.catalogue, path)) return;
    if (!tab) {
      persist([...entriesRef.current.filter(entry => entry.path !== path), { path, phase: "parked" }]);
      return;
    }
    const previous = entriesRef.current;
    persist([...previous.filter(entry => entry.path !== path), { path, phase: "parking" }]);
    waitForTabs.current = latest.current.app.tabs;
    try { await latest.current.operations.close(tab.sessionId); }
    catch (cause) {
      if (unknownOutcome(cause)) uncertain.current = true;
      else { waitForTabs.current = undefined; persist(previous); }
      throw cause;
    }
    // If this write fails, the persisted pending intent is still recoverable.
    persist(entriesRef.current.map(entry => entry.path === path ? { path, phase: "parked" } : entry));
  });

  const resume = (path: string) => run(async () => {
    if (!entriesRef.current.some(entry => entry.path === path)) return;
    const id = await latest.current.operations.open(path);
    persist(entriesRef.current.filter(entry => entry.path !== path));
    latest.current.operations.focus(id);
  });

  const archive = (path: string) => run(async () => {
    const tab = latest.current.app.tabs.find(tab => tab.sessionPath === path);
    if (tab && tab.status !== "idle") return;
    await latest.current.operations.archive(path, true);
    persist(entriesRef.current.filter(entry => entry.path !== path));
  });

  const later = useMemo(() => {
    const open = new Set(app.tabs.map(tab => tab.sessionPath));
    const saved = new Set(entries.filter(entry => !open.has(entry.path)).map(entry => entry.path));
    return historyRows(app.catalogue).filter(row => saved.has(row.path));
  }, [entries, app.catalogue, app.tabs]);
  return {
    later,
    pending: pending || uncertain.current || entries.some(entry => entry.phase === "parking" && app.sdkInventory.some(tab => tab.sessionPath === entry.path && tab.status === "closing")), error,
    select, park, resume, archive, dismissError: () => setError(undefined),
  };
}
