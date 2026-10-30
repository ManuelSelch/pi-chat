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
interface ArchiveUndo { path: string; later: boolean; open: boolean }
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
  const waitForCatalogue = useRef<AppState["catalogue"] | undefined>(undefined);
  const latest = useRef({ app, operations });
  latest.current = { app, operations };
  const [undoRecord, setUndoRecord] = useState<ArchiveUndo>();

  function persist(next: LaterEntry[]) {
    if (!initial.readable) throw new Error(initial.error);
    saveLater(endpoint, next);
    entriesRef.current = next;
    setEntries(next);
  }
  // Do not reconcile a command against inventory from before its result. New
  // authoritative inventory/catalogue/connection updates resolve uncertainty.
  useEffect(() => {
    if (app.connection !== "open" || !app.tabsKnown || locked.current || !initial.readable) return;
    if (waitForTabs.current === app.tabs || waitForCatalogue.current === app.catalogue) return;
    waitForTabs.current = undefined;
    waitForCatalogue.current = undefined;
    uncertain.current = false;
    const closing = new Set(app.sdkInventory.filter(tab => tab.status === "closing").flatMap(tab => tab.sessionPath ? [tab.sessionPath] : []));
    const next = reconcileLater(entriesRef.current, app.tabs, app.catalogue, closing);
    if (JSON.stringify(next) === JSON.stringify(entriesRef.current)) return;
    try { persist(next); uncertain.current = false; }
    catch (cause) { setError(errorText(cause)); }
  }, [app.sdkInventory, app.tabs, app.catalogue, app.connection, app.tabsKnown, pending]);

  async function run(operation: () => Promise<void>) {
    if (locked.current || uncertain.current || latest.current.app.connection !== "open") return;
    locked.current = true; setPending(true); setError(undefined);
    try { await operation(); }
    catch (cause) {
      setError(unknownOutcome(cause) ? `${errorText(cause)} The server outcome is unknown; reload to reconcile. No retry was sent.` : errorText(cause));
    }
    finally { locked.current = false; setPending(false); }
  }

  const park = (id: string) => run(async () => {
    const tab = latest.current.app.tabs.find(tab => tab.sessionId === id);
    if (!tab || tab.status !== "idle" || !tab.sessionPath || !hasSavedSession(latest.current.app.catalogue, tab.sessionPath)) return;
    const path = tab.sessionPath;
    const previous = entriesRef.current;
    persist([...previous.filter(entry => entry.path !== path), { path, phase: "parking" }]);
    waitForTabs.current = latest.current.app.tabs;
    try { await latest.current.operations.close(id); }
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
    const record = { path, later: entriesRef.current.some(entry => entry.path === path), open: Boolean(tab) };
    await latest.current.operations.archive(path, true);
    setUndoRecord(record);
    persist(entriesRef.current.filter(entry => entry.path !== path));
  });

  const undo = () => run(async () => {
    if (!undoRecord) return;
    waitForCatalogue.current = undoRecord.later && !hasSavedSession(latest.current.app.catalogue, undoRecord.path) ? latest.current.app.catalogue : undefined;
    try { await latest.current.operations.archive(undoRecord.path, false); }
    catch (cause) { waitForCatalogue.current = undefined; throw cause; }
    if (undoRecord.later) persist([...entriesRef.current.filter(entry => entry.path !== undoRecord.path), { path: undoRecord.path, phase: "parked" }]);
    else if (undoRecord.open) {
      const id = await latest.current.operations.open(undoRecord.path);
      latest.current.operations.focus(id);
    }
    setUndoRecord(undefined);
  });

  const later = useMemo(() => {
    const open = new Set(app.tabs.map(tab => tab.sessionPath));
    const saved = new Set(entries.filter(entry => !open.has(entry.path)).map(entry => entry.path));
    return historyRows(app.catalogue).filter(row => saved.has(row.path));
  }, [entries, app.catalogue, app.tabs]);
  return {
    later,
    pending: pending || uncertain.current || entries.some(entry => entry.phase === "parking" && app.sdkInventory.some(tab => tab.sessionPath === entry.path && tab.status === "closing")), error, canUndo: Boolean(undoRecord),
    park, resume, archive, undo, dismissError: () => setError(undefined),
  };
}
