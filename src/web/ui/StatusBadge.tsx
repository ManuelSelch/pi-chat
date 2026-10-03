import { Badge, type BadgeProps } from "@mantine/core";
import { MANTINE_COLOR } from "../theme.js";

export type StatusBadgeTone = keyof typeof MANTINE_COLOR;

export interface StatusBadgeProps extends Omit<BadgeProps, "color"> {
  tone?: StatusBadgeTone;
  color?: string;
}

/** Shared semantic badge with the application's status color vocabulary. */
export function StatusBadge({ tone = "neutral", color, variant = "light", size = "xs", children, ...props }: StatusBadgeProps) {
  return (
    <Badge color={color ?? MANTINE_COLOR[tone]} variant={variant} size={size} {...props}>
      {children}
    </Badge>
  );
}
