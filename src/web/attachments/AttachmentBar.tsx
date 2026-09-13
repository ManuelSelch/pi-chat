import { useState, type DragEvent, type KeyboardEvent } from "react";
import { ActionIcon, Badge, Button, Group, Text, TextInput } from "@mantine/core";

interface AttachmentBarProps {
  paths: string[];
  onChange: (paths: string[]) => void;
  disabled?: boolean;
}

function fileName(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.at(-1) ?? path;
}

/**
 * Attachments are references, not uploads: browsers never expose a real path for
 * a dropped File, so the reliable input is a typed or pasted path. Drops are
 * still accepted when the source hands over text such as a `file://` URL.
 */
export function AttachmentBar({ paths, onChange, disabled }: AttachmentBarProps) {
  const [draft, setDraft] = useState("");
  const [dropActive, setDropActive] = useState(false);

  function add(value: string): void {
    const path = value.trim();
    if (!path || paths.includes(path)) return;
    onChange([...paths, path]);
    setDraft("");
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== "Enter") return;
    event.preventDefault();
    add(draft);
  }

  function drop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setDropActive(false);
    const text = event.dataTransfer.getData("text/uri-list") || event.dataTransfer.getData("text/plain");
    for (const line of text.split(/\r?\n/)) add(line);
  }

  return (
    <div
      onDragOver={(event) => { event.preventDefault(); setDropActive(true); }}
      onDragLeave={() => setDropActive(false)}
      onDrop={drop}
    >
      {paths.length > 0 ? (
        <Group gap={6} mb={6}>
          {paths.map((path) => (
            <Badge
              key={path}
              variant="light"
              size="lg"
              title={path}
              rightSection={
                <ActionIcon size="xs" variant="transparent" aria-label={`Remove ${path}`} onClick={() => onChange(paths.filter((entry) => entry !== path))}>
                  ×
                </ActionIcon>
              }
            >
              {fileName(path)}
            </Badge>
          ))}
        </Group>
      ) : null}
      <Group gap="xs" wrap="nowrap">
        <TextInput
          aria-label="Attachment path"
          placeholder={dropActive ? "Drop the path here…" : "Attach a local path, e.g. ~/Documents/notes.pdf"}
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={keyDown}
          size="xs"
          flex={1}
        />
        <Button size="compact-xs" variant="light" disabled={disabled || !draft.trim()} onClick={() => add(draft)}>
          Attach
        </Button>
      </Group>
      <Text size="xs" c="dimmed" mt={4}>
        Paths stay local: images are sent to the model, other files are passed as a path reference.
      </Text>
    </div>
  );
}
