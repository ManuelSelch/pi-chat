import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { ActionIcon, Button, Group, Modal, Radio, ScrollArea, Stack, Text, Textarea, TextInput, UnstyledButton } from "@mantine/core";
import { IconMinus } from "@tabler/icons-react";
import { Markdown } from "../../chat/markdown/MarkdownLazy.js";
import { THEME } from "../../ui/theme.js";
import type { UiPrompt, UiPromptResult } from "../../app/state/view-types.js";
import { usePromptFocus } from "./use-prompt-focus.js";
import { useComposerFocusReturn } from "../../ui/focus/composer-focus.js";
import { createPromptDraft, type PromptDraft } from "./domain/prompt-drafts.js";

interface PromptModalProps {
  prompt?: UiPrompt;
  onRespond: (promptId: string, result: UiPromptResult) => void;
  draft?: PromptDraft;
  onDraftChange?: (patch: Partial<PromptDraft>) => void;
  minimized?: boolean;
  onMinimize?: () => void;
  disabled?: boolean;
}

const SEARCH_THRESHOLD = 8;
const PREFORMATTED = /[░▒▓█│├└─┌┐┘]/;
/** Only immediate menu redraws use the anti-flicker handover delay. */
const HANDOVER_MS = 400;

function splitHeading(title: string): { heading: string; body?: string } {
  const [first = "", ...rest] = title.split("\n");
  const body = rest.join("\n").trim();
  return { heading: first.trim(), ...(body ? { body } : {}) };
}
function isSameMenu(previous: UiPrompt, next: UiPrompt): boolean {
  if (previous.kind !== "select" || next.kind !== "select" || previous.submission === "explicit" || next.submission === "explicit") return false;
  if ((previous.options?.length ?? 0) !== (next.options?.length ?? 0)) return false;
  const shape = (title: string) => splitHeading(title).heading.replace(/[\d/]+/g, "");
  return shape(previous.title) === shape(next.title);
}

/** Pure prompt view. Production drafts belong to the browser presentation controller. */
export function PromptModal({ prompt, onRespond, draft: controlledDraft, onDraftChange, minimized = false, onMinimize, disabled = false }: PromptModalProps) {
  const [localDraft, setLocalDraft] = useState(() => createPromptDraft(prompt ?? {}));
  const lastDraft = useRef(localDraft);
  const draft = onDraftChange ? controlledDraft ?? lastDraft.current : localDraft;
  const { value, query, activeOption, selectedOption } = draft;
  const patchRef = useRef(onDraftChange);
  patchRef.current = onDraftChange;
  function patch(patch: Partial<PromptDraft>): void {
    if (patchRef.current) patchRef.current(patch);
    else setLocalDraft(current => ({ ...current, ...patch }));
  }

  const [shown, setShown] = useState<UiPrompt | undefined>(prompt);
  const [closing, setClosing] = useState(false);
  const wasMinimized = useRef(minimized);
  const visible = Boolean(shown) && !closing && !minimized && (prompt !== undefined || !wasMinimized.current);
  const focusReturn = useComposerFocusReturn(visible);
  const previous = useRef<UiPrompt | undefined>(undefined);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const mouseActive = useRef<number | null>(null);
  const waiting = prompt === undefined || disabled || minimized;
  const explicit = shown?.kind === "select" && shown.submission === "explicit";
  const allOptions = shown?.options ?? [];
  const searchable = allOptions.length > SEARCH_THRESHOLD && !explicit;
  const needle = query.trim().toLowerCase();
  const options = needle ? allOptions.filter(option => option.toLowerCase().includes(needle)) : allOptions;
  const active = Math.min(activeOption, Math.max(options.length - 1, 0));
  const focusRef = usePromptFocus<HTMLElement>(shown?.id, visible && !waiting && (shown?.kind !== "select" || searchable));

  useEffect(() => {
    if (prompt) { setShown(prompt); setClosing(false); return; }
    if (minimized || wasMinimized.current) { setShown(undefined); return; }
    const timer = setTimeout(() => setClosing(true), shown?.submission === "explicit" || shown?.body ? 0 : HANDOVER_MS);
    return () => clearTimeout(timer);
  }, [prompt, minimized]);
  useEffect(() => { wasMinimized.current = minimized; }, [minimized]);

  useEffect(() => {
    if (!prompt) return;
    const carry = previous.current !== undefined && isSameMenu(previous.current, prompt);
    previous.current = prompt;
    if (onDraftChange) return;
    setLocalDraft(current => ({ ...createPromptDraft(prompt), ...(carry ? { query: current.query, activeOption: current.activeOption } : {}) }));
  }, [prompt?.id]);
  useEffect(() => { if (prompt) lastDraft.current = draft; });

  useEffect(() => {
    if (!visible || shown?.kind !== "select" || searchable) return;
    const frame = requestAnimationFrame(() => {
      if (explicit) dialogRef.current?.querySelector<HTMLElement>('[role="radio"], input[type="radio"]')?.focus();
      else listRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [shown?.id, shown?.kind, searchable, visible, explicit]);

  useEffect(() => {
    if (!visible) return;
    const containFocus = (event: FocusEvent) => {
      const dialog = dialogRef.current;
      const target = event.target;
      if (!dialog || !(target instanceof HTMLElement) || dialog.contains(target)) return;
      if (target.closest('[role="dialog"]')) return;
      const control = dialog.querySelector<HTMLElement>("[data-autofocus]:not(:disabled)") ?? dialog.querySelector<HTMLElement>("button:not(:disabled)");
      control?.focus({ preventScroll: true });
    };
    document.addEventListener("focusin", containFocus);
    return () => document.removeEventListener("focusin", containFocus);
  }, [visible]);

  useEffect(() => {
    if (visible && mouseActive.current !== active) activeRef.current?.scrollIntoView({ block: "nearest" });
    mouseActive.current = null;
  }, [active, visible]);

  if (!shown) return null;
  const cancel = (): void => { if (!waiting) onRespond(shown.id, { cancelled: true }); };
  const submit = (result: string | boolean): void => { if (!waiting) onRespond(shown.id, { cancelled: false, value: result }); };

  function optionKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (!options.length || waiting) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      patch({ activeOption: (active + step + options.length) % options.length });
    } else if (event.key === "Enter" && options[active]) {
      event.preventDefault();
      submit(options[active]);
    }
  }
  function optionMouseMove(event: MouseEvent<HTMLElement>, index: number): void {
    const last = pointer.current;
    if (last && last.x === event.clientX && last.y === event.clientY) return;
    pointer.current = { x: event.clientX, y: event.clientY };
    if (index !== active) { mouseActive.current = index; patch({ activeOption: index }); }
  }
  function textKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.nativeEvent.isComposing || event.key !== "Enter") return;
    if (shown!.kind === "editor" && !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    submit(value);
  }

  const { heading, body } = shown.body ? { heading: shown.title, body: undefined } : splitHeading(shown.title);
  const confirmLabel = shown.submitLabel ?? (shown.kind === "confirm" ? "Confirm" : "OK");
  const canSubmit = !waiting && (shown.kind !== "input" || value.trim().length > 0);

  return <Modal.Root
    {...focusReturn}
    opened={visible}
    onExitTransitionEnd={() => {
      if (!closing && !minimized) return;
      if (!minimized) setShown(undefined);
      focusReturn.onExitTransitionEnd();
    }}
    onClose={cancel}
    closeOnClickOutside={false}
    centered size={shown.body ? 720 : "lg"} radius="md"
    styles={{ title: { lineHeight: 1.4, flex: 1 } }}
  >
    <Modal.Overlay />
    <Modal.Content ref={dialogRef}>
      <Modal.Header>
        <Modal.Title><Text fw={600} size="sm">{heading}</Text></Modal.Title>
        {onMinimize ? <ActionIcon variant="subtle" color="gray" aria-label="Minimize question" onClick={onMinimize}><IconMinus size={18} /></ActionIcon> : <Modal.CloseButton />}
      </Modal.Header>
      <Modal.Body>
    <Stack gap="md">
      {shown.body ? shown.body.format === "markdown" ? <div className="markdown overflow-x-auto text-sm"><Markdown disableImages>{shown.body.text}</Markdown></div> : <Text size="sm" className="whitespace-pre-wrap">{shown.body.text}</Text> : null}
      {[body, shown.message].filter(Boolean).map((text, index) => <Text key={index} size={PREFORMATTED.test(text!) ? "xs" : "sm"} c="dimmed" ff={PREFORMATTED.test(text!) ? "monospace" : undefined} style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>{text}</Text>)}

      {searchable ? <TextInput ref={focusRef} aria-label="Filter options" data-autofocus placeholder="Type to filter…" value={query} disabled={waiting} onChange={event => patch({ query: event.currentTarget.value, activeOption: 0 })} onKeyDown={optionKeyDown} /> : null}

      {shown.kind === "select" && explicit ? <Radio.Group value={selectedOption ?? ""} onChange={selectedOption => patch({ selectedOption })} aria-label={heading}>
        <Stack gap="xs">{allOptions.map(option => <Radio.Card key={option} value={option} aria-label={option} p="sm" withBorder disabled={waiting}>
          <Group wrap="nowrap" gap="sm"><Radio.Indicator /><Text size="sm">{option}</Text></Group>
        </Radio.Card>)}</Stack>
      </Radio.Group> : null}

      {shown.kind === "select" && !explicit ? <ScrollArea.Autosize mah="50vh"><Stack gap={2} ref={listRef} tabIndex={0} data-autofocus role="listbox" aria-label={heading} onKeyDown={optionKeyDown} className="outline-none">
        {options.length === 0 ? <Text size="sm" c="dimmed" p="8px 12px">No option matches “{query.trim()}”.</Text> : null}
        {options.map((option, index) => <UnstyledButton key={option} ref={index === active ? activeRef : undefined} role="option" aria-selected={index === active} disabled={waiting} onMouseMove={event => optionMouseMove(event, index)} onClick={() => submit(option)} p="8px 12px" style={{ borderRadius: "var(--mantine-radius-sm)", background: index === active ? THEME.surface.panelHover : undefined, borderLeft: `2px solid ${index === active ? THEME.accent.primary : "transparent"}` }}><Text size="sm">{option}</Text></UnstyledButton>)}
      </Stack></ScrollArea.Autosize> : null}

      {shown.kind === "input" ? <TextInput ref={focusRef} aria-label={heading} data-autofocus placeholder={shown.placeholder} value={value} disabled={waiting} onChange={event => patch({ value: event.currentTarget.value })} onKeyDown={textKeyDown} /> : null}
      {shown.kind === "editor" ? <Textarea ref={focusRef} aria-label={heading} data-autofocus rows={8} value={value} disabled={waiting} onChange={event => patch({ value: event.currentTarget.value })} onKeyDown={textKeyDown} /> : null}

      <Group justify="space-between" align="center" pt="sm">
        {onMinimize ? <Button variant="subtle" color="gray" onClick={onMinimize} leftSection={<IconMinus size={15} />}>Minimize</Button> : <Text size="xs" c="dimmed">{shown.kind === "select" ? "↑↓ to move · Enter to choose · Esc to cancel" : shown.kind === "editor" ? "⌘↵ to submit · Esc to cancel" : "Enter to submit · Esc to cancel"}</Text>}
        <Group gap="xs">
          <Button variant="default" onClick={cancel} disabled={waiting}>{shown.cancelLabel ?? "Cancel"}</Button>
          {shown.kind === "select" ? <Button disabled={waiting || (explicit ? selectedOption === undefined : !options[active])} onClick={() => submit(explicit ? selectedOption! : options[active]!)}>{confirmLabel}</Button>
            : <Button ref={shown.kind === "confirm" ? focusRef : undefined} data-autofocus={shown.kind === "confirm" ? true : undefined} disabled={!canSubmit} onClick={() => submit(shown.kind === "confirm" ? true : value)}>{confirmLabel}</Button>}
        </Group>
      </Group>
    </Stack>
      </Modal.Body>
    </Modal.Content>
  </Modal.Root>;
}
