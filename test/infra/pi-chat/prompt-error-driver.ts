import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { PiChatDriver } from "./pi-chat-driver.js";

function invalidSectionExtension(pi: ExtensionAPI): void {
  pi.on("before_agent_start", async event => {
    if (event.prompt === "Invalid section") event.systemPromptOptions.sections.agenticFlow = "Invalid";
  });
}

export class PromptErrorDriver {
  private constructor(private readonly app: PiChatDriver) {}

  static async start(): Promise<PromptErrorDriver> {
    return new PromptErrorDriver(await PiChatDriver.start({
      extensions: [invalidSectionExtension],
      responses: [{ prompt: "Model failure", reply: "", error: "Model failed" }],
    }));
  }

  async sendPromptWithInvalidSystemSection(): Promise<void> {
    await this.app.chat.sendPromptExpectingFailure("Invalid section");
  }

  async sendPromptWithModelFailure(): Promise<void> {
    await this.app.chat.sendPromptExpectingFailure("Model failure");
  }

  async shouldShowErrorOnce(message: string): Promise<void> {
    await this.app.extensions.waitForNotification(message, "error");
    this.app.extensions.shouldShowNotificationCount(message, "error", 1);
  }

  async shouldKeepErrorOutOfOtherConversation(): Promise<void> {
    const first = this.app.tabs.active();
    await this.app.tabs.create();
    this.app.extensions.shouldShowNotificationCount("Invalid system prompt section name: agenticFlow", "error", 0);
    await this.app.tabs.switchTo(first);
    this.app.extensions.shouldShowNotificationCount("Invalid system prompt section name: agenticFlow", "error", 1);
  }

  dispose(): Promise<void> { return this.app.dispose(); }
}
