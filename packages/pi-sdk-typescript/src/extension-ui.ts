import { promptPresentationSchema, type PromptPresentation } from "./protocol/prompt-presentation.js";

export type { PromptPresentation } from "./protocol/prompt-presentation.js";
export interface PromptUI {
  select(title: string, options: string[]): Promise<string | undefined>;
  editor(title: string, prefill?: string): Promise<string | undefined>;
  withPromptPresentation?<T>(presentation: PromptPresentation, run: () => Promise<T>): Promise<T>;
}
export interface PromptContext { mode: string; ui: PromptUI }
interface PresentedRequest extends Omit<PromptPresentation, "submission"> { title: string }
export interface PresentedSelect extends PresentedRequest { options: string[]; submission: "immediate" | "explicit" }
export interface PresentedEditor extends PresentedRequest { prefill?: string }

function validateTitle(title: string): void {
  if (!title.trim()) throw new Error("Prompt title must not be empty");
}
function present<T>(ctx: PromptContext, title: string, presentation: PromptPresentation, run: (title: string) => Promise<T>): Promise<T> {
  validateTitle(title);
  const checked = promptPresentationSchema.parse(presentation);
  if (ctx.mode === "tui") {
    return run(checked.body ? title + "\n\n" + checked.body.text : title);
  }
  if (!ctx.ui.withPromptPresentation) throw new Error("This host does not support prompt presentation");
  return ctx.ui.withPromptPresentation(checked, () => run(title));
}

/** Display a native select, with explicit presentation on supported browser hosts. */
export async function selectWithPresentation(ctx: PromptContext, request: PresentedSelect): Promise<string | undefined> {
  const { title, options, ...presentation } = request;
  if (!options.length || options.some(option => !option.trim()) || new Set(options).size !== options.length) {
    throw new Error("Select options must be non-empty and unique");
  }
  return present(ctx, title, presentation, heading => ctx.ui.select(heading, options));
}

/** Display a separate native editor; an empty submission remains an empty string. */
export async function editWithPresentation(ctx: PromptContext, request: PresentedEditor): Promise<string | undefined> {
  const { title, prefill, ...presentation } = request;
  return present(ctx, title, presentation, heading => ctx.ui.editor(heading, prefill));
}
