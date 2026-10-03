import { Paper, type PaperProps } from "@mantine/core";
import type { ReactNode } from "react";

export interface PanelProps extends PaperProps {
  children: ReactNode;
}

/** Shared bordered surface for settings and other compact feature sections. */
export function Panel({ children, ...props }: PanelProps) {
  return (
    <Paper withBorder radius="md" p="sm" {...props}>
      {children}
    </Paper>
  );
}
