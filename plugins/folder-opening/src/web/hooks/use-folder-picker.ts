import { useCallback, useEffect, useRef, useState } from "react";
import type { DirectoryListing } from "@manuelselch/pi-sdk/protocol";
import type { FolderPickerProps } from "../types.js";

export function useFolderPicker({ opened, connected, initialPath, onClose, browseDirectories, startSession }: FolderPickerProps) {
  const [listing, setListing] = useState<DirectoryListing>();
  const [input, setInput] = useState("");
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string>();
  const lastListing = useRef<DirectoryListing | undefined>(undefined);
  const hiddenRef = useRef(false);
  const initialPathRef = useRef(initialPath);
  initialPathRef.current = initialPath;
  const operation = useRef<{ generation: number; abort?: AbortController }>({ generation: 0 });

  const invalidate = useCallback(() => {
    ++operation.current.generation;
    operation.current.abort?.abort();
  }, []);

  const navigate = useCallback(async (path: string, showHidden: boolean, cursor?: string) => {
    invalidate();
    const generation = operation.current.generation;
    const abort = new AbortController();
    operation.current.abort = abort;
    setLoading(true);
    setError(undefined);
    const previous = lastListing.current;
    try {
      const result = await browseDirectories({
        path, ...(previous ? { basePath: previous.path } : {}), showHidden, ...(cursor ? { cursor } : {}),
      }, abort.signal);
      if (generation !== operation.current.generation) return;
      const next = cursor && previous?.path === result.path
        ? { ...result, entries: [...previous.entries, ...result.entries].filter((entry, index, all) => all.findIndex((e) => e.path === entry.path) === index) }
        : result;
      lastListing.current = next;
      setListing(next);
      setInput(next.path);
    } catch (reason) {
      if (generation === operation.current.generation) setError(reason instanceof Error ? reason.message : "Unable to read this folder.");
    } finally {
      if (generation === operation.current.generation) setLoading(false);
    }
  }, [browseDirectories, invalidate]);

  useEffect(() => {
    if (!opened) {
      lastListing.current = undefined;
      setListing(undefined);
      setStarting(false);
      setError(undefined);
      setHidden(false);
      hiddenRef.current = false;
      return;
    }
    if (connected) void navigate(lastListing.current?.path ?? initialPathRef.current ?? "~", hiddenRef.current);
    else { invalidate(); setLoading(false); setStarting(false); }
    return invalidate;
  }, [opened, connected, navigate, invalidate]);

  async function start(): Promise<void> {
    if (!listing || !input || loading || starting || !connected) return;
    invalidate();
    const generation = operation.current.generation;
    const abort = new AbortController();
    operation.current.abort = abort;
    setStarting(true);
    setError(undefined);
    try {
      let target = listing;
      if (input !== listing.path) {
        target = await browseDirectories({ path: input, basePath: listing.path, showHidden: hiddenRef.current }, abort.signal);
        if (generation !== operation.current.generation) return;
        lastListing.current = target;
        setListing(target);
        setInput(target.path);
      }
      await startSession(target.path, abort.signal);
      if (generation === operation.current.generation) onClose();
    } catch (reason) {
      if (generation === operation.current.generation) setError(reason instanceof Error ? reason.message : "Unable to start a session.");
    } finally {
      if (generation === operation.current.generation) setStarting(false);
    }
  }

  const browse = (path: string) => { if (connected && !starting) void navigate(path, hiddenRef.current); };
  return { listing, input, setInput, hidden, loading, starting, error, invalidate, navigate, start, browse,
    changeHidden(next: boolean) {
      hiddenRef.current = next;
      setHidden(next);
      void navigate(listing?.path ?? initialPath ?? "~", next);
    },
  };
}
