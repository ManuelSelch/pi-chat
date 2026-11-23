import { InboxContainer } from "../../features/sessions/inbox/components/InboxContainer.js";
import { useAppController } from "../AppControllerContext.js";
import { PromptModal } from "../../features/extensions/prompts/components/PromptModal.js";
import { QuickOpenContainer } from "../../features/sessions/quick-open/components/QuickOpenContainer.js";
import { PluginOverlayOutlet } from "../plugins/PluginProvider.js";
import { SettingsContainer } from "../../features/settings/components/SettingsContainer.js";

/** App-level assembly only; each feature retains its own overlay behavior. */
export function AppOverlays() {
  const chat = useAppController();
  return (
    <>
      <PromptModal key={JSON.stringify([chat.app.serverInstanceId, chat.app.activeSessionId])} prompt={chat.promptPresentation.prompt} draft={chat.promptPresentation.draft}
        onDraftChange={chat.promptPresentation.update} minimized={chat.promptPresentation.minimized}
        onMinimize={chat.promptPresentation.minimize} disabled={chat.promptPresentation.disabled}
        onRespond={chat.promptPresentation.respond} />
      <QuickOpenContainer />
      <InboxContainer />
      <PluginOverlayOutlet />
      <SettingsContainer />
    </>
  );
}
