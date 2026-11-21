import { z } from "zod";

/** /model offers all available models; this subset defines its Scoped view. */
export const modelScopeSchema = z.object({ scoped: z.array(z.string()) });

export function validateModelScope(prompt: { kind: string; submission?: string; options?: string[]; modelScope?: z.infer<typeof modelScopeSchema> }, ctx: z.RefinementCtx): void {
  if (!prompt.modelScope) return;
  if (prompt.kind !== "select" || prompt.submission !== "immediate") {
    ctx.addIssue({ code: "custom", path: ["modelScope"], message: "Model scope requires an immediate select" });
    return;
  }
  const available = new Set(prompt.options);
  if (prompt.modelScope.scoped.some(model => !available.has(model)))
    ctx.addIssue({ code: "custom", path: ["modelScope", "scoped"], message: "Scoped models must be offered options" });
}
