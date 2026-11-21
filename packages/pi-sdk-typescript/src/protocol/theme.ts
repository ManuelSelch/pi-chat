import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
/** Concrete Pi palette delivered only by successful session.open/create results. */
export const sessionThemeSchema = z.object({
  name: z.string().min(1).max(128).regex(/^[^\u0000-\u001f\u007f-\u009f]+$/),
  appearance: z.enum(["light", "dark"]),
  colors: z.object({
    accent: hexColor, text: hexColor, muted: hexColor, border: hexColor,
    selectedBg: hexColor, mdLink: hexColor, success: hexColor, warning: hexColor, error: hexColor,
    userMessageBg: hexColor, userMessageText: hexColor, thinkingText: hexColor,
    toolDiffAdded: hexColor, toolDiffRemoved: hexColor,
  }),
  surfaces: z.object({ pageBg: hexColor, cardBg: hexColor, infoBg: hexColor }),
});
export type SessionTheme = z.infer<typeof sessionThemeSchema>;
