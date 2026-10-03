import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Breadcrumbs, Button, Checkbox, Group, Loader, Modal, ScrollArea, Stack, Text, TextInput } from "@mantine/core";
import { MANTINE_COLOR } from "../theme.js";
import { IconFolder } from "@tabler/icons-react";
import type { DirectoryBrowse, DirectoryListing } from "../../shared/directories.js";

interface FolderPickerProps {
  opened: boolean;
  connected: boolean;
  initialPath?: string;
  onClose: () => void;
  browseDirectories: (request: DirectoryBrowse, signal?: AbortSignal) => Promise<DirectoryListing>;
  startSession: (path: string, signal?: AbortSignal) => Promise<string>;
}

export function FolderPicker({ opened, connected, initialPath, onClose, browseDirectories, startSession }: FolderPickerProps) {
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
  return (
    <Modal opened={opened} onClose={() => { if (!starting) { invalidate(); onClose(); } }} title="Open server folder" size="lg" centered
      closeOnEscape={!starting} closeOnClickOutside={!starting} withCloseButton={!starting}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || event.nativeEvent.isComposing || (event.target as HTMLElement).closest("button")) return;
        event.preventDefault();
        void start();
      }}>
      <Stack gap="sm">
        {!connected ? <Alert color={MANTINE_COLOR.warning}>Reconnect to browse server folders.</Alert> : null}
        {error ? <Alert color={MANTINE_COLOR.danger} role="alert">{error}</Alert> : null}
        <form onSubmit={(event) => { event.preventDefault(); void start(); }}>
          <Group align="flex-end" wrap="nowrap">
            <TextInput label="Server folder path" aria-label="Server folder path" value={input} onChange={(event) => setInput(event.currentTarget.value)}
              placeholder="~/projects" style={{ flex: 1 }} disabled={!connected || starting} />
            <Button type="button" variant="light" disabled={!connected || starting || !input} onClick={() => browse(input)}>Go</Button>
          </Group>
        </form>
        {listing ? <>
          <Group align="center" wrap="nowrap" gap={2}>
            <Text size="sm" c="dimmed">/</Text>
            <Breadcrumbs separator=" / " style={{ display: 'flex', alignItems: 'center', gap: '2px', flexWrap: 'wrap' }}>
              {listing.breadcrumbs
                .filter((crumb) => !(crumb.name === "/" && crumb.path === "/"))
                .map((crumb) => (
                  <Button key={crumb.path} size="compact-xs" variant="subtle" disabled={!connected || starting} onClick={() => browse(crumb.path)}>
                    {crumb.name}
                  </Button>
                ))}
            </Breadcrumbs>
          </Group>
        </> : null}
        <Group gap="xs">
          <Button size="xs" variant="default" disabled={!connected || starting || !listing?.parentPath} onClick={() => browse(listing!.parentPath!)}>Up</Button>
          <Button size="xs" variant="default" disabled={!connected || starting} onClick={() => browse("~")}>Home</Button>
          <Button size="xs" variant="default" disabled={!connected || starting} onClick={() => browse(listing?.path ?? initialPath ?? "~")}>Refresh</Button>
          <Checkbox label="Show hidden folders" checked={hidden} disabled={!connected || starting} onChange={(event) => {
            const next = event.currentTarget.checked;
            hiddenRef.current = next;
            setHidden(next);
            void navigate(listing?.path ?? initialPath ?? "~", next);
          }} />
        </Group>
        <ScrollArea h={280}>
          <Stack gap={4} aria-label="Server subfolders" aria-busy={loading}>
            {loading ? <Group><Loader size="xs" /><Text size="sm" role="status">Loading folders…</Text></Group> : null}
            {listing?.entries.map((entry) => <Button key={entry.path} variant="subtle" justify="flex-start" leftSection={<IconFolder size={16} />}
              disabled={!connected || starting || loading} onClick={() => browse(entry.path)}>{entry.name}</Button>)}
            {!loading && listing?.entries.length === 0 ? <Text size="sm" c="dimmed">No subfolders.</Text> : null}
            {listing?.nextCursor ? <Button variant="light" disabled={!connected || starting || loading} onClick={() => void navigate(listing.path, hidden, listing.nextCursor)}>Load more folders</Button> : null}
          </Stack>
        </ScrollArea>
        <Group justify="flex-end">
          <Button variant="default" disabled={starting} onClick={() => { invalidate(); onClose(); }}>Cancel</Button>
          <Button disabled={!connected || !listing || !input || loading || starting} loading={starting} onClick={() => void start()}>Open</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
