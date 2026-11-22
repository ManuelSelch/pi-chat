import { Alert, Breadcrumbs, Button, Checkbox, Group, Loader, Modal, ScrollArea, Stack, Text, TextInput } from "@mantine/core";
import { IconFolder } from "@tabler/icons-react";
import type { FolderPickerProps } from "../types.js";
import type { useFolderPicker } from "../hooks/use-folder-picker.js";

type FolderPickerViewProps = FolderPickerProps & ReturnType<typeof useFolderPicker>;

/** Presentation-only picker; browsing state and side effects live in the hook. */
export function FolderPickerView({ opened, connected, initialPath, onClose, returnFocus, onExitTransitionEnd,
  listing, input, setInput, hidden, loading, starting, error, invalidate, navigate, start, browse, changeHidden }: FolderPickerViewProps) {
  return (
    <Modal returnFocus={returnFocus} onExitTransitionEnd={onExitTransitionEnd} opened={opened} onClose={() => { if (!starting) { invalidate(); onClose(); } }} title="Open server folder" size="lg" centered
      closeOnEscape={!starting} closeOnClickOutside={!starting} withCloseButton={!starting}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || event.nativeEvent.isComposing || (event.target as HTMLElement).closest("button")) return;
        event.preventDefault();
        void start();
      }}>
      <Stack gap="sm">
        {!connected ? <Alert color="yellow" variant="light">Reconnect to browse server folders.</Alert> : null}
        {error ? <Alert color="red" variant="light" role="alert">{error}</Alert> : null}
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
            changeHidden(event.currentTarget.checked);
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
