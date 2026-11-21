import { useState } from "react";
import { Button, Group, Modal, ScrollArea, SegmentedControl, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";

const models = [
  { id: "anthropic/claude-sonnet-4", scoped: true },
  { id: "anthropic/claude-opus-4", scoped: true },
  { id: "openai/gpt-4.1", scoped: false },
  { id: "openai/o4-mini", scoped: true },
  { id: "google/gemini-2.5-pro", scoped: false },
  { id: "google/gemini-2.5-flash", scoped: false },
];

/** Mirrors the existing select-prompt modal, not a new footer picker. */
export function ModelPicker() {
  const [opened, setOpened] = useState(true);
  const [scope, setScope] = useState("scoped");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState("anthropic/claude-sonnet-4");
  const options = models.filter(model => (scope === "all" || model.scoped) && model.id.toLowerCase().includes(query.trim().toLowerCase()));
  const index = Math.min(active, Math.max(options.length - 1, 0));
  function choose(id: string) { setSelected(id); setOpened(false); }
  function move(event: React.KeyboardEvent<HTMLElement>) {
    if (event.nativeEvent.isComposing || !options.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    } else if (event.key === "Enter") { event.preventDefault(); choose(options[index]!.id); }
  }
  return <main className="page">
    <Stack align="center" gap="sm" className="preview-launcher">
      <Text size="sm" c="dimmed">Existing /model popup · mockup</Text>
      <Button variant="default" onClick={() => { setOpened(true); setQuery(""); setActive(0); }}>Open /model</Button>
      <Text size="xs" c="dimmed">Current model: {selected}</Text>
    </Stack>
    <Modal.Root opened={opened} onClose={() => setOpened(false)} closeOnClickOutside={false} centered size="lg" radius="md">
      <Modal.Overlay />
      <Modal.Content>
        <Modal.Header><Modal.Title><Text fw={600} size="sm">Select model</Text></Modal.Title><Modal.CloseButton /></Modal.Header>
        <Modal.Body><Stack gap="md">
          <TextInput data-autofocus aria-label="Filter models" placeholder="Type to filter…" value={query} onChange={event => { setQuery(event.currentTarget.value); setActive(0); }} onKeyDown={move} />
          <SegmentedControl aria-label="Model scope" fullWidth value={scope} onChange={value => { setScope(value); setActive(0); }} data={[{ label: "Scoped", value: "scoped" }, { label: "All models", value: "all" }]} />
          <ScrollArea.Autosize mah="50vh"><Stack gap={2} role="listbox" aria-label="Select model" tabIndex={0} onKeyDown={move}>
            {!options.length && <Text size="sm" c="dimmed" p="8px 12px">No option matches “{query.trim()}”.</Text>}
            {options.map((model, i) => <UnstyledButton key={model.id} role="option" aria-selected={i === index} onMouseMove={() => setActive(i)} onClick={() => choose(model.id)} p="8px 12px" style={{ borderRadius: "var(--mantine-radius-sm)", background: i === index ? "var(--mantine-color-dark-5)" : undefined, borderLeft: `2px solid ${i === index ? "var(--mantine-color-blue-4)" : "transparent"}` }}><Text size="sm">{model.id}{selected === model.id ? " (current)" : ""}</Text></UnstyledButton>)}
          </Stack></ScrollArea.Autosize>
          <Group justify="flex-end" align="center" pt="sm">
            <Group gap="xs"><Button variant="default" onClick={() => setOpened(false)}>Cancel</Button><Button disabled={!options[index]} onClick={() => { if (options[index]) choose(options[index].id); }}>OK</Button></Group>
          </Group>
        </Stack></Modal.Body>
      </Modal.Content>
    </Modal.Root>
  </main>;
}
