import { useEffect } from "react";
import { Button, Group, Modal, NavLink, ScrollArea, Stack, Text } from "@mantine/core";
import type { DirectoryListing } from "../../shared/protocol.js";

interface FilePickerModalProps {
  opened: boolean;
  onClose: () => void;
  listing?: DirectoryListing;
  browseDirectory: (path?: string) => void;
  onSelect: (path: string) => void;
}

export function FilePickerModal({ opened, onClose, listing, browseDirectory, onSelect }: FilePickerModalProps) {
  useEffect(() => {
    if (opened) browseDirectory(listing?.path);
    // Reopening should refresh the current folder, not react to every listing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  return (
    <Modal opened={opened} onClose={onClose} title="Attach a file" size="lg">
      <Stack gap="xs">
        <Group gap="xs" wrap="nowrap">
          <Button
            size="compact-xs"
            variant="light"
            disabled={!listing?.parent}
            onClick={() => browseDirectory(listing?.parent)}
          >
            Up
          </Button>
          <Text size="xs" c="dimmed" truncate>{listing?.path ?? "Loading…"}</Text>
        </Group>
        <ScrollArea h="55vh">
          <Stack gap={2}>
            {listing?.entries.map((entry) => (
              <NavLink
                key={entry.path}
                label={entry.name}
                leftSection={entry.isDirectory ? "📁" : "📄"}
                onClick={() => {
                  if (entry.isDirectory) browseDirectory(entry.path);
                  else {
                    onSelect(entry.path);
                    onClose();
                  }
                }}
              />
            ))}
            {listing && listing.entries.length === 0 ? <Text c="dimmed" size="sm">This folder is empty.</Text> : null}
          </Stack>
        </ScrollArea>
      </Stack>
    </Modal>
  );
}
