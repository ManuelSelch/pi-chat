import { useEffect, useRef, useState } from "react";
import { Box, Group, Text } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { Markdown } from "./Markdown.js";

/**
 * The model's reasoning for one turn.
 *
 * It opens itself while the thought is still arriving — watching it is the
 * point of streaming it — and closes again once the answer is there, so a
 * finished transcript is not buried under chains of thought. Either of those
 * automatic moves is dropped the moment the reader operates the panel: their
 * choice outranks the default for as long as that message is on screen.
 *
 * Native details/summary keeps it keyboard-operable and searchable by the
 * browser's own find when open.
 */
export function ThinkingPanel({ thinking, streaming }: { thinking: string; streaming: boolean }) {
  const [open, setOpen] = useState(streaming);
  const touched = useRef(false);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (touched.current) return;
    setOpen(streaming);
  }, [streaming]);

  // The panel is its own scroller, so a long chain cannot push the answer off
  // screen; while it streams it stays pinned to the newest line.
  useEffect(() => {
    if (!streaming || !open) return;
    const element = body.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [thinking, streaming, open]);

  return (
    <Box
      component="details"
      data-testid="thinking-panel"
      open={open}
      onToggle={(event) => {
        touched.current = true;
        setOpen((event.currentTarget as HTMLDetailsElement).open);
      }}
      mb={6}
    >
      <Box
        component="summary"
        style={{ cursor: "pointer", listStyle: "none", userSelect: "none", width: "fit-content" }}
      >
        <Group gap={4} wrap="nowrap" c="dimmed">
          <IconChevronRight
            size={13}
            style={{ flex: "none", transform: open ? "rotate(90deg)" : undefined, transition: "transform 150ms" }}
          />
          <Text
            size="xs"
            fw={650}
            tt="uppercase"
            lts={1}
            className={streaming ? "thinking-live" : undefined}
          >
            {streaming ? "Thinking…" : "Thinking"}
          </Text>
        </Group>
      </Box>
      <Box
        ref={body}
        className="markdown markdown-thinking"
        // The transcript is a polite live region, and reasoning streams a token
        // at a time: inherited, it would read the whole chain of thought aloud
        // over the answer it exists to support. It stays readable on demand,
        // it just stops announcing itself.
        aria-live="off"
        mt={4}
        pl="sm"
        mah={280}
        style={{
          overflowY: "auto",
          borderLeft: "2px solid var(--mantine-color-default-border)",
        }}
      >
        <Markdown>{thinking}</Markdown>
      </Box>
    </Box>
  );
}
