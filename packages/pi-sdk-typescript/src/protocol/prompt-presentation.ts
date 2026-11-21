import { z } from "zod";

export const promptBodySchema = z.object({
  format: z.enum(["plain", "markdown"]),
  text: z.string().max(32768),
});
export const promptPresentationShape = {
  body: promptBodySchema.optional(),
  submitLabel: z.string().trim().min(1).max(64).optional(),
  cancelLabel: z.string().trim().min(1).max(64).optional(),
};
export const promptSubmissionSchema = z.enum(["immediate", "explicit"]);
export const promptPresentationSchema = z.object({
  ...promptPresentationShape,
  submission: promptSubmissionSchema.optional(),
});
export type PromptPresentation = z.infer<typeof promptPresentationSchema>;
