export interface PromptDraft {
  value: string;
  query: string;
  activeOption: number;
  selectedOption?: string;
  minimized: boolean;
  submitting: boolean;
}
export function createPromptDraft(prompt: { prefill?: string }): PromptDraft {
  return { value: prompt.prefill ?? "", query: "", activeOption: 0, selectedOption: undefined, minimized: false, submitting: false };
}
export function promptDraftKey(server: string, session: string, prompt: string): string {
  return JSON.stringify([server, session, prompt]);
}
export function reconcilePromptDrafts(drafts: Record<string, PromptDraft>, live: ReadonlySet<string>): Record<string, PromptDraft> {
  const entries = Object.entries(drafts);
  return entries.every(([key]) => live.has(key)) ? drafts : Object.fromEntries(entries.filter(([key]) => live.has(key)));
}
