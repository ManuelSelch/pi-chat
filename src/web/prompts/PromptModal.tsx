import { useEffect, useState, type KeyboardEvent } from "react";
import { Button, Group, Modal, Radio, Stack, Text, Textarea, TextInput } from "@mantine/core";
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

  useEffect(() => {
    // Each prompt starts from its own defaults, including a re-opened one
    // restored from a snapshot after a reload.
    setValue(prompt?.prefill ?? prompt?.options?.[0] ?? "");
  }, [prompt?.id, prompt?.prefill, prompt?.options]);

  if (!prompt) return null;

  const cancel = (): void => onRespond(prompt.id, { cancelled: true });
  const submit = (result: string | boolean): void => onRespond(prompt.id, { cancelled: false, value: result });

  function keyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key !== "Enter") return;
    // The editor is multi-line, so plain Enter must insert a newline there.
    if (prompt!.kind === "editor" && !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    submit(prompt!.kind === "confirm" ? true : value);
  }

  const canSubmit = prompt.kind === "confirm" || prompt.kind === "editor" || value.trim().length > 0;

  return (
    <Modal
      opened
      onClose={cancel}
      title={prompt.title}
      // An accidental outside click must not answer a permission gate.
      closeOnClickOutside={false}
      centered
    >
      <Stack gap="md">
        {prompt.message ? <Text size="sm">{prompt.message}</Text> : null}

        {prompt.kind === "select" ? (
          <Radio.Group value={value} onChange={setValue} aria-label={prompt.title}>
            <Stack gap={6} onKeyDown={keyDown}>
              {prompt.options?.map((option) => <Radio key={option} value={option} label={option} />)}
            </Stack>
          </Radio.Group>
        ) : null}

        {prompt.kind === "input" ? (
          <TextInput
            aria-label={prompt.title}
            data-autofocus
            placeholder={prompt.placeholder}
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
            onKeyDown={keyDown}
          />
        ) : null}

        {prompt.kind === "editor" ? (
          <Textarea
            aria-label={prompt.title}
            data-autofocus
            rows={6}
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
            onKeyDown={keyDown}
          />
        ) : null}

        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={cancel}>Cancel</Button>
          <Button
            disabled={!canSubmit}
            onClick={() => submit(prompt.kind === "confirm" ? true : value)}
          >
            {prompt.kind === "confirm" ? "Confirm" : "OK"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
