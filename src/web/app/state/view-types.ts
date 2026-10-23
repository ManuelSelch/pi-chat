import type * as Contract from "@manuelselch/pi-sdk/protocol";
import type { ReadonlyDeep } from "@manuelselch/pi-sdk";

/** Read-only inputs for views consuming SDK-owned state; never thaw/copy the contract. */
export type ProjectCatalogue = ReadonlyDeep<Contract.ProjectCatalogue>;
export type ChatProjectSummary = ReadonlyDeep<Contract.ChatProjectSummary>;
export type ChatSessionSummary = ReadonlyDeep<Contract.ChatSessionSummary>;
export type WebFeature = ReadonlyDeep<Contract.WebFeature>;
export type Widget = ReadonlyDeep<Contract.Widget>;
export type UiPrompt = ReadonlyDeep<Contract.UiPrompt>;
export type AppTabStatus = "idle" | "running" | "blocked";
export interface AppTab { sessionId: string; sessionPath?: string; title: string; projectPath: string; projectName: string; status: AppTabStatus }
export type Tab = AppTab;
export type TabStatus = AppTabStatus;
export type { ThinkingLevel, UiPromptResult, FooterItem, PiChatBadge, PiChatButton } from "@manuelselch/pi-sdk/protocol";
