import { useState, type DragEvent } from "react";
import { ActionIcon, Badge, Button, Group } from "@mantine/core";
import type { DirectoryListing } from "../../shared/protocol.js";
import { FilePickerModal } from "./FilePickerModal.js";

interface AttachmentBarProps {
  paths: string[];
  onChange: (paths: string[]) => void;
  listing?: DirectoryListing;
  browseDirectory: (path?: string) => void;
  disabled?: boolean;
}

function fileName(path: string): string {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

/**
 * Attachments are references, not uploads. A browser file input never exposes a
 * real path, so picking runs against the server's own filesystem view.
 */
export function AttachmentBar({ paths, onChange, listing, browseDirectory, disabled }: AttachmentBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  function add(value: string): void {
    const path = value.trim();
    if (!path || paths.includes(path)) return;
    onChange([...paths, path]);
  }

  function drop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    const text = event.dataTransfer.getData("text/uri-list") || event.dataTransfer.getData("text/plain");
    for (const line of text.split(/\r?\n/)) add(line);
  }

  return (
    <div onDragOver={(event) => event.preventDefault()} onDrop={drop}>
      <FilePickerModal
        opened={pickerOpen}
        onClose={() => setPickerOpen(false)}
        listing={listing}
        browseDirectory={browseDirectory}
        onSelect={add}
      />
      <Group gap={6} mb={6} wrap="wrap">
        <Button size="compact-xs" variant="subtle" disabled={disabled} onClick={() => setPickerOpen(true)}>
          Attach
        </Button>
        {paths.map((path) => (
          <Badge
            key={path}
            variant="light"
            size="lg"
            title={path}
            rightSection={
              <ActionIcon
                size="xs"
                variant="transparent"
                aria-label={`Remove ${path}`}
                onClick={() => onChange(paths.filter((entry) => entry !== path))}
              >
                ×
              </ActionIcon>
            }
          >
            {fileName(path)}
          </Badge>
        ))}
      </Group>
    </div>
  );
}
