import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button, Group, Modal, ScrollArea, Stack, Text, Textarea, TextInput, UnstyledButton } from "@mantine/core";
import type { UiPrompt, UiPromptResult } from "../../shared/protocol.js";

interface PromptModalProps {
  prompt?: UiPrompt;
  onRespond: (promptId: string, result: UiPromptResult) => void;
}

/**
 * The browser side of a blocking `ctx.ui` question. An extension is suspended
 * until this answers, so dismissing must send an explicit cancellation rather
 * than just closing the window.
 */
/** Below this a filter box is more clutter than help. */
const SEARCH_THRESHOLD = 8;

/**
 * Extensions pass whole status reports as the prompt title, including bar
 * charts drawn with block characters. Those only line up in a monospace font.
 */
const PREFORMATTED = /[░▒▓█│├└─┌┐┘]/;

function splitHeading(title: string): { heading: string; body?: string } {
  const [first = "", ...rest] = title.split("\n");
  const body = rest.join("\n").trim();
  return { heading: first.trim(), ...(body ? { body } : {}) };
}

export function PromptModal({ prompt, onRespond }: PromptModalProps) {
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [activeOption, setActiveOption] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const allOptions = prompt?.options ?? [];
  const searchable = allOptions.length > SEARCH_THRESHOLD;
  const needle = query.trim().toLowerCase();
  const options = needle ? allOptions.filter((option) => option.toLowerCase().includes(needle)) : allOptions;

  useEffect(() => {
    // Each prompt starts from its own defaults, including one restored from a
    // snapshot after a reload.
    setValue(prompt?.prefill ?? "");
    setQuery("");
    setActiveOption(0);
  }, [prompt?.id, prompt?.prefill]);

  useEffect(() => {
    // The modal's focus trap runs after mount and would otherwise leave focus
    // on the close button, where arrow keys do nothing. With a filter box the
    // trap's own autofocus already lands in the right place.
    if (prompt?.kind !== "select" || searchable) return;
    const frame = requestAnimationFrame(() => listRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [prompt?.id, prompt?.kind, searchable]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeOption]);

  if (!prompt) return null;

  const cancel = (): void => onRespond(prompt.id, { cancelled: true });
  const submit = (result: string | boolean): void => onRespond(prompt.id, { cancelled: false, value: result });

  function optionKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (options.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveOption((index) => (index + step + options.length) % options.length);
      return;
    }
    if (event.key === "Enter" && options[activeOption]) {
      event.preventDefault();
      submit(options[activeOption]);
    }
  }

  function textKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key !== "Enter") return;
    // The editor is multi-line, so plain Enter must insert a newline there.
    if (prompt!.kind === "editor" && !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    submit(value);
  }

  const { heading, body } = splitHeading(prompt.title);
  const confirmLabel = prompt.kind === "confirm" ? "Confirm" : "OK";
  const canSubmit = prompt.kind !== "input" || value.trim().length > 0;

  return (
    <Modal
      opened
      onClose={cancel}
      // An accidental outside click must not answer a permission gate.
      closeOnClickOutside={false}
      centered
      size="lg"
      radius="md"
      title={<Text fw={600} size="sm">{heading}</Text>}
      styles={{ title: { lineHeight: 1.4, paddingRight: "var(--mantine-spacing-md)" } }}
    >
      <Stack gap="md">
        {[body, prompt.message].filter(Boolean).map((text, index) => (
          <Text
            key={index}
            size={PREFORMATTED.test(text!) ? "xs" : "sm"}
            c="dimmed"
            ff={PREFORMATTED.test(text!) ? "monospace" : undefined}
            style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}
          >
            {text}
          </Text>
        ))}

        {prompt.kind === "select" && searchable ? (
          <TextInput
            aria-label="Filter options"
            data-autofocus
            placeholder="Type to filter…"
            value={query}
            onChange={(event) => { setQuery(event.currentTarget.value); setActiveOption(0); }}
            onKeyDown={optionKeyDown}
          />
        ) : null}

        {prompt.kind === "select" ? (
          <ScrollArea.Autosize mah="50vh">
            <Stack
              gap={2}
              ref={listRef}
              tabIndex={0}
              data-autofocus
              role="listbox"
              aria-label={heading}
              onKeyDown={optionKeyDown}
              style={{ outline: "none" }}
            >
              {options.length === 0 ? (
                <Text size="sm" c="dimmed" p="8px 12px">No option matches “{query.trim()}”.</Text>
              ) : null}
              {options.map((option, index) => (
                <UnstyledButton
                  key={option}
                  ref={index === activeOption ? activeRef : undefined}
                  role="option"
                  aria-selected={index === activeOption}
                  onMouseEnter={() => setActiveOption(index)}
                  onClick={() => submit(option)}
                  p="8px 12px"
                  style={{
                    borderRadius: "var(--mantine-radius-sm)",
                    background: index === activeOption ? "var(--mantine-color-default-hover)" : undefined,
                    borderLeft: `2px solid ${index === activeOption ? "var(--mantine-primary-color-filled)" : "transparent"}`,
                  }}
                >
                  <Text size="sm">{option}</Text>
                </UnstyledButton>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        ) : null}

        {prompt.kind === "input" ? (
          <TextInput
            aria-label={heading}
            data-autofocus
            placeholder={prompt.placeholder}
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
            onKeyDown={textKeyDown}
          />
        ) : null}

        {prompt.kind === "editor" ? (
          <Textarea
            aria-label={heading}
            data-autofocus
            rows={8}
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
            onKeyDown={textKeyDown}
          />
        ) : null}

        <Group justify="space-between" align="center">
          <Text size="xs" c="dimmed">
            {prompt.kind === "select"
              ? "↑↓ to move · Enter to choose · Esc to cancel"
              : prompt.kind === "editor"
                ? "⌘↵ to submit · Esc to cancel"
                : "Enter to submit · Esc to cancel"}
          </Text>
          <Group gap="xs">
            <Button variant="default" onClick={cancel}>Cancel</Button>
            {prompt.kind === "select" ? (
              <Button disabled={!options[activeOption]} onClick={() => submit(options[activeOption]!)}>
                {confirmLabel}
              </Button>
            ) : (
              <Button data-autofocus={prompt.kind === "confirm" ? true : undefined} disabled={!canSubmit} onClick={() => submit(prompt.kind === "confirm" ? true : value)}>
                {confirmLabel}
              </Button>
            )}
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
