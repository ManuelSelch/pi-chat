import { useState } from "react";
import { Box, Text } from "@mantine/core";
import type { SkillInvocation as Skill } from "../../../shared/protocol.js";
import { Markdown } from "../markdown/MarkdownLazy.js";
import { THEME } from "../../ui/theme.js";

/** A user skill invocation, not a synthetic tool call or a second history entry. */
export function SkillInvocation({ skill, compact, onLocalLink }: {
  skill: Skill; compact: boolean; onLocalLink?: (path: string) => void;
}) {
  const [opened, setOpened] = useState(false);
  return (
    <Box
      component="details"
      data-testid="skill-invocation"
      onToggle={event => {
        if (event.target === event.currentTarget) setOpened((event.currentTarget as HTMLDetailsElement).open);
      }}
      style={{
        border: compact ? 0 : `1px solid ${THEME.border.default}`,
        borderRadius: compact ? 0 : "var(--mantine-radius-md)",
        background: compact ? "transparent" : THEME.surface.panel,
      }}
    >
      <Box component="summary" style={{ cursor: "pointer", listStyle: "none", padding: compact ? "2px 0" : "8px 12px" }}>
        <Text ff="monospace" fw={compact ? 500 : 600} size={compact ? "xs" : "sm"}>[skill] {skill.name}</Text>
      </Box>
      {opened ? (
        <Box p="sm">
          <Text ff="monospace" size="xs" c="dimmed" mb="xs" style={{ overflowWrap: "anywhere" }}>{skill.location}</Text>
          <div className="markdown"><Markdown onLocalLink={onLocalLink}>{skill.content}</Markdown></div>
        </Box>
      ) : null}
    </Box>
  );
}
