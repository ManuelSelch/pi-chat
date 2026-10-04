import { Alert, type AlertProps } from "@mantine/core";
import { MANTINE_COLOR } from "./theme.js";

export type NoticeTone = keyof typeof MANTINE_COLOR;

export interface NoticeProps extends Omit<AlertProps, "color"> {
  tone?: NoticeTone;
  color?: string;
}

/** Shared alert surface with the application's semantic color vocabulary. */
export function Notice({ tone = "info", color, variant = "light", children, ...props }: NoticeProps) {
  return (
    <Alert color={color ?? MANTINE_COLOR[tone]} variant={variant} {...props}>
      {children}
    </Alert>
  );
}
