import { Group, Text, type TextProps } from "@mantine/core";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  icon?: ReactNode;
  children: ReactNode;
  textProps?: TextProps;
}

/** Consistent icon-and-title header for panels and settings sections. */
export function SectionHeader({ icon, children, textProps }: SectionHeaderProps) {
  return (
    <Group gap={6} mb={6}>
      {icon}
      <Text fw={650} size="sm" {...textProps}>{children}</Text>
    </Group>
  );
}
