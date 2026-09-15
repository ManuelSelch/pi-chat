import { Badge, Group, Text } from "@mantine/core";
import type { FooterItem } from "../../shared/protocol.js";

/**
 * The composer footer, the browser's counterpart to the terminal's footer line:
 * extension labels such as `/readonly`'s `READONLY` on the left, and what the
 * session runs with — model, thinking level — on the right.
 *
 * Nothing here knows what any single entry means. The session says what its
 * footer contains, so adding something to it never reaches this file; all this
 * decides is that pinned state reads as a badge and background detail stays
 * quiet. Entries keep their given order within a side, which is how the server
 * expresses precedence.
 */
function FooterEntry({ item }: { item: FooterItem }) {
  if (item.variant === "badge") {
    return (
      <Badge size="sm" radius="sm" variant="light" color="yellow" tt="none">
        {item.text}
      </Badge>
    );
  }
  return <Text size="xs" c="dimmed">{item.text}</Text>;
}

export function Footer({ items }: { items: FooterItem[] }) {
  const left = items.filter((item) => item.align !== "right");
  const right = items.filter((item) => item.align === "right");
  if (items.length === 0) return null;
  return (
    <Group gap={6} mt={6} px={12} wrap="nowrap" align="center" justify="space-between">
      <Group gap={6} wrap="wrap" align="center">
        {left.map((item) => (
          <FooterEntry key={item.key} item={item} />
        ))}
      </Group>
      {/* The right side is the quiet one, so it yields its space first. The
          separator is the terminal's own way of joining these into one line. */}
      <Group gap={6} wrap="nowrap" align="center" style={{ minWidth: 0, overflow: "hidden" }}>
        {right.map((item, index) => (
          <Group key={item.key} gap={6} wrap="nowrap" align="center">
            {index === 0 ? null : <Text size="xs" c="dimmed" aria-hidden>·</Text>}
            <FooterEntry item={item} />
          </Group>
        ))}
      </Group>
    </Group>
  );
}
