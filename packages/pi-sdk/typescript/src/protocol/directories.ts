import { z } from "zod";

const pathSchema = z.string().min(1).max(4096).refine((path) => !path.includes("\0"), "Invalid path");
export const directoryBrowseSchema = z.object({
  path: pathSchema,
  basePath: pathSchema.optional(),
  showHidden: z.boolean().optional(),
  cursor: z.string().min(1).max(4096).optional(),
});
export const directoryListingSchema = z.object({
  path: pathSchema,
  parentPath: pathSchema.optional(),
  breadcrumbs: z.array(z.object({ name: z.string(), path: pathSchema })),
  entries: z.array(z.object({ name: z.string(), path: pathSchema })),
  nextCursor: z.string().optional(),
});
export type DirectoryBrowse = z.infer<typeof directoryBrowseSchema>;
export type DirectoryListing = z.infer<typeof directoryListingSchema>;
