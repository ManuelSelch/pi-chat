import { z } from "zod";
import { defineRemoteContract } from "@manuelselch/pi-sdk/plugins";

const projectPath = z.string().min(1).max(4096).refine(value => !value.includes("\0"));
const objectId = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
export const comparisonSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("uncommitted") }).strict(),
  z.object({ kind: z.literal("branch"), ref: z.string().max(1024).regex(/^refs\/(?:heads|remotes)\/[^\0]+$/) }).strict(),
  z.object({ kind: z.literal("commit"), sha: objectId }).strict(),
]);
const errorSchema = z.object({ ok: z.literal(false), error: z.object({
  code: z.enum(["notRepository", "invalidBase", "tooLarge", "operationFailed"]), message: z.string(),
}) });
const result = <T extends z.ZodType>(value: T) => z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), value }), errorSchema,
]);
export const changedFileSchema = z.object({
  path: z.string(), status: z.enum(["A","M","D","T"]), patch: z.string(),
  binary: z.boolean(), added: z.number().int().nonnegative(), removed: z.number().int().nonnegative(),
});
export const diffSnapshotSchema = z.object({
  branch: z.string(), baseCommit: objectId, files: z.array(changedFileSchema),
});
export const repositoryContextSchema = z.object({
  branch: z.string(),
  branches: z.array(z.object({ ref: z.string(), name: z.string(), remote: z.boolean() })),
});
export const commitPageSchema = z.object({
  commits: z.array(z.object({ sha: objectId, subject: z.string(), author: z.string(), date: z.string() })),
  nextOffset: z.number().int().nonnegative().nullable(),
});
export const diffViewerContract = defineRemoteContract({
  id: "diff-viewer", version: 1,
  methods: {
    context: { input: z.object({ projectPath }).strict(), output: result(repositoryContextSchema) },
    commits: { input: z.object({ projectPath, query: z.string().max(200), offset: z.number().int().min(0).max(100000) }).strict(), output: result(commitPageSchema) },
    diff: { input: z.object({ projectPath, comparison: comparisonSchema }).strict(), output: result(diffSnapshotSchema) },
  },
});
export type Comparison = z.infer<typeof comparisonSchema>;
export type ChangedFile = z.infer<typeof changedFileSchema>;
export type DiffSnapshot = z.infer<typeof diffSnapshotSchema>;
export type RepositoryContext = z.infer<typeof repositoryContextSchema>;
export type CommitPage = z.infer<typeof commitPageSchema>;
