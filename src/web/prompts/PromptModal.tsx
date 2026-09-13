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
export function PromptModal({ prompt, onRespond }: PromptModalProps) {
  const [value, setValue] = useState("");
  const [activeOption, setActiveOption] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const options = prompt?.options ?? [];

  useEffect(() => {
    // Each prompt starts from its own defaults, including one restored from a
    // snapshot after a reload.
    setValue(prompt?.prefill ?? "");
    setActiveOption(0);
  }, [prompt?.id, prompt?.prefill]);

  useEffect(() => {
    // The modal's focus trap runs after mount and would otherwise leave focus
    // on the close button, where arrow keys do nothing.
    if (prompt?.kind !== "select") return;
    const frame = requestAnimationFrame(() => listRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [prompt?.id, prompt?.kind]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeOption]);

  if (!prompt) return null;

  const cancel = (): void => onRespond(prompt.id, { cancelled: true });
  const submit = (result: string | boolean): void => onRespond(prompt.id, { cancelled: false, value: result });

  function optionKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
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
      title={<Text fw={600} size="sm">{prompt.title}</Text>}
      styles={{ title: { lineHeight: 1.4, paddingRight: "var(--mantine-spacing-md)" } }}
    >
      <Stack gap="md">
        {prompt.message ? (
          <Text size="sm" c="dimmed" style={{ whiteSpace: "pre-wrap" }}>{prompt.message}</Text>
        ) : null}

        {prompt.kind === "select" ? (
          <ScrollArea.Autosize mah="50vh">
            <Stack
              gap={2}
              ref={listRef}
              tabIndex={0}
              data-autofocus
              role="listbox"
              aria-label={prompt.title}
              onKeyDown={optionKeyDown}
              style={{ outline: "none" }}
            >
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
            aria-label={prompt.title}
            data-autofocus
            placeholder={prompt.placeholder}
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
            onKeyDown={textKeyDown}
          />
        ) : null}

        {prompt.kind === "editor" ? (
          <Textarea
            aria-label={prompt.title}
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
              <Button disabled={options.length === 0} onClick={() => submit(options[activeOption]!)}>
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
