import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
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

/**
 * An extension running a menu in a loop answers one select and immediately asks
 * the next one. Closing and reopening the modal in between makes the whole
 * dialog blink, so an answered prompt stays on screen this long to give its
 * successor a chance to take its place.
 */
const HANDOVER_MS = 400;

function splitHeading(title: string): { heading: string; body?: string } {
  const [first = "", ...rest] = title.split("\n");
  const body = rest.join("\n").trim();
  return { heading: first.trim(), ...(body ? { body } : {}) };
}

/**
 * Whether `next` is the same menu redrawn, in which case the caret and the
 * filter survive the handover instead of jumping back to the first option.
 * Both the heading counter and the option labels change as items are toggled,
 * so only the shape of the menu is compared.
 */
function isSameMenu(previous: UiPrompt, next: UiPrompt): boolean {
  if (previous.kind !== "select" || next.kind !== "select") return false;
  if ((previous.options?.length ?? 0) !== (next.options?.length ?? 0)) return false;
  const shape = (title: string) => splitHeading(title).heading.replace(/[\d/]+/g, "");
  return shape(previous.title) === shape(next.title);
}

export function PromptModal({ prompt, onRespond }: PromptModalProps) {
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [activeOption, setActiveOption] = useState(0);
  // What is on screen: the live prompt, or the one just answered while its
  // successor is still in flight.
  const [shown, setShown] = useState<UiPrompt | undefined>(prompt);
  const previous = useRef<UiPrompt | undefined>(undefined);
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  // Last real pointer position. Scrolling the list fires mouse events without
  // the pointer having moved, which would drag the selection back under it.
  const pointer = useRef<{ x: number; y: number } | null>(null);

  // No live prompt means the extension has not asked the next question yet, so
  // the lingering dialog must not accept input.
  const waiting = prompt === undefined;
  const allOptions = shown?.options ?? [];
  const searchable = allOptions.length > SEARCH_THRESHOLD;
  const needle = query.trim().toLowerCase();
  const options = needle ? allOptions.filter((option) => option.toLowerCase().includes(needle)) : allOptions;
  const active = Math.min(activeOption, Math.max(options.length - 1, 0));

  useEffect(() => {
    if (prompt) {
      setShown(prompt);
      return;
    }
    const timer = setTimeout(() => setShown(undefined), HANDOVER_MS);
    return () => clearTimeout(timer);
  }, [prompt]);

  useEffect(() => {
    if (!prompt) return;
    // Each prompt starts from its own defaults, including one restored from a
    // snapshot after a reload — unless it is the same menu drawn again.
    const carry = previous.current !== undefined && isSameMenu(previous.current, prompt);
    previous.current = prompt;
    setValue(prompt.prefill ?? "");
    if (carry) return;
    setQuery("");
    setActiveOption(0);
  }, [prompt]);

  useEffect(() => {
    // The modal's focus trap runs after mount and would otherwise leave focus
    // on the close button, where arrow keys do nothing. With a filter box the
    // trap's own autofocus already lands in the right place.
    if (shown?.kind !== "select" || searchable) return;
    const frame = requestAnimationFrame(() => listRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [shown?.id, shown?.kind, searchable]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!shown) return null;

  const cancel = (): void => {
    if (!waiting) onRespond(shown.id, { cancelled: true });
  };
  const submit = (result: string | boolean): void => {
    if (!waiting) onRespond(shown.id, { cancelled: false, value: result });
  };

  function optionKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (options.length === 0 || waiting) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveOption((index) => (Math.min(index, options.length - 1) + step + options.length) % options.length);
      return;
    }
    if (event.key === "Enter" && options[active]) {
      event.preventDefault();
      submit(options[active]);
    }
  }

  /**
   * Activate an option only when the pointer genuinely moved over it. A plain
   * mouseenter also fires when the list scrolls under a resting cursor, which
   * made arrow-key navigation snap back.
   */
  function optionMouseMove(event: MouseEvent<HTMLElement>, index: number): void {
    const last = pointer.current;
    if (last && last.x === event.clientX && last.y === event.clientY) return;
    pointer.current = { x: event.clientX, y: event.clientY };
    setActiveOption(index);
  }

  function textKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key !== "Enter") return;
    // The editor is multi-line, so plain Enter must insert a newline there.
    if (shown!.kind === "editor" && !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    submit(value);
  }

  const { heading, body } = splitHeading(shown.title);
  const confirmLabel = shown.kind === "confirm" ? "Confirm" : "OK";
  const canSubmit = !waiting && (shown.kind !== "input" || value.trim().length > 0);

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
        {[body, shown.message].filter(Boolean).map((text, index) => (
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

        {shown.kind === "select" && searchable ? (
          <TextInput
            aria-label="Filter options"
            data-autofocus
            placeholder="Type to filter…"
            value={query}
            onChange={(event) => { setQuery(event.currentTarget.value); setActiveOption(0); }}
            onKeyDown={optionKeyDown}
          />
        ) : null}

        {shown.kind === "select" ? (
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
                  ref={index === active ? activeRef : undefined}
                  role="option"
                  aria-selected={index === active}
                  onMouseMove={(event) => optionMouseMove(event, index)}
                  onClick={() => submit(option)}
                  p="8px 12px"
                  style={{
                    borderRadius: "var(--mantine-radius-sm)",
                    background: index === active ? "var(--mantine-color-default-hover)" : undefined,
                    borderLeft: `2px solid ${index === active ? "var(--mantine-primary-color-filled)" : "transparent"}`,
                  }}
                >
                  <Text size="sm">{option}</Text>
                </UnstyledButton>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        ) : null}

        {shown.kind === "input" ? (
          <TextInput
            aria-label={heading}
            data-autofocus
            placeholder={shown.placeholder}
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
            onKeyDown={textKeyDown}
          />
        ) : null}

        {shown.kind === "editor" ? (
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
            {shown.kind === "select"
              ? "↑↓ to move · Enter to choose · Esc to cancel"
              : shown.kind === "editor"
                ? "⌘↵ to submit · Esc to cancel"
                : "Enter to submit · Esc to cancel"}
          </Text>
          <Group gap="xs">
            <Button variant="default" onClick={cancel} disabled={waiting}>Cancel</Button>
            {shown.kind === "select" ? (
              <Button disabled={waiting || !options[active]} onClick={() => submit(options[active]!)}>
                {confirmLabel}
              </Button>
            ) : (
              <Button data-autofocus={shown.kind === "confirm" ? true : undefined} disabled={!canSubmit} onClick={() => submit(shown.kind === "confirm" ? true : value)}>
                {confirmLabel}
              </Button>
            )}
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
