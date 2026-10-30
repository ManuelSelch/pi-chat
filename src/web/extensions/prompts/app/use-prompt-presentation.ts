import { useEffect, useRef, useState } from "react";
import type { UiPrompt, UiPromptResult } from "../../../app/state/view-types.js";
import { createPromptDraft, promptDraftKey, reconcilePromptDrafts, type PromptDraft } from "../domain/prompt-drafts.js";

interface Input {
  serverInstanceId?: string;
  activeSessionId: string;
  connection: "open" | "connecting" | "superseded";
  sessions: Record<string, { prompts: readonly UiPrompt[] }>;
  respond(promptId: string, result: UiPromptResult, sessionId: string): Promise<unknown>;
}

/** Browser-owned presentation; never write drafts into the SDK snapshot projection. */
export function usePromptPresentation(input: Input) {
  const [drafts, setDrafts] = useState<Record<string, PromptDraft>>({});
  const inFlight = useRef(new Set<string>());
  const server = input.serverInstanceId ?? "";
  const prompt = input.sessions[input.activeSessionId]?.prompts.at(-1);
  const key = prompt ? promptDraftKey(server, input.activeSessionId, prompt.id) : undefined;
  const draft = prompt && key ? drafts[key] ?? createPromptDraft(prompt) : undefined;
  const lastTop = useRef<{ key: string; server: string; session: string; prompt: UiPrompt; draft: PromptDraft } | undefined>(undefined);
  const latest = useRef(input);
  latest.current = input;

  useEffect(() => {
    // Reconnecting retains the last authoritative list. Only reconcile a ready projection.
    if (input.connection !== "open") return;
    const live = new Set(Object.entries(input.sessions).flatMap(([session, state]) => state.prompts.map(p => promptDraftKey(server, session, p.id))));
    setDrafts(current => reconcilePromptDrafts(current, live));
    for (const pending of inFlight.current) if (!live.has(pending)) inFlight.current.delete(pending);
  }, [server, input.sessions, input.connection]);

  useEffect(() => {
    if (!prompt || !key || !draft) return;
    const previous = lastTop.current;
    if (previous && previous.key !== key && previous.server === server && previous.session === input.activeSessionId && !drafts[key]
      && previous.prompt.kind === "select" && prompt.kind === "select" && previous.prompt.submission === "immediate" && prompt.submission === "immediate"
      && previous.prompt.options?.length === prompt.options?.length
      && previous.prompt.title.split("\n")[0]!.replace(/[\d/]+/g, "") === prompt.title.split("\n")[0]!.replace(/[\d/]+/g, "")) {
      setDrafts(current => current[key] ? current : { ...current, [key]: { ...draft, query: previous.draft.query, activeOption: previous.draft.activeOption } });
    }
    lastTop.current = { key, server, session: input.activeSessionId, prompt, draft };
  }, [key, prompt, draft, server, input.activeSessionId]);

  function update(patch: Partial<PromptDraft>): void {
    if (!key || !prompt) return;
    setDrafts(current => ({ ...current, [key]: { ...(current[key] ?? createPromptDraft(prompt)), ...patch } }));
  }
  function respond(promptId: string, result: UiPromptResult): void {
    const now = latest.current;
    if (!key || !prompt || prompt.id !== promptId || now.connection !== "open" || inFlight.current.has(key)
      || now.serverInstanceId !== input.serverInstanceId || now.activeSessionId !== input.activeSessionId
      || now.sessions[input.activeSessionId]?.prompts.at(-1)?.id !== promptId) return;
    const owner = input.activeSessionId;
    inFlight.current.add(key);
    update({ submitting: true });
    void input.respond(promptId, result, owner).catch(() => {
      inFlight.current.delete(key);
      const now = latest.current;
      if (now.serverInstanceId !== input.serverInstanceId || !now.sessions[owner]?.prompts.some(p => p.id === promptId)) return;
      setDrafts(current => current[key] ? { ...current, [key]: { ...current[key], submitting: false } } : current);
    });
  }
  return { prompt, draft, update, respond, disabled: input.connection !== "open" || Boolean(draft?.submitting),
    minimized: Boolean(draft?.minimized), minimize: () => update({ minimized: true }), reopen: () => update({ minimized: false }) };
}
