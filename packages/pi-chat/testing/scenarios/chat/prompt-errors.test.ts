import { afterEach, beforeEach, describe, it } from "vitest";
import { PromptErrorDriver } from "../../infra/pi-chat/prompt-error-driver.js";

let app: PromptErrorDriver;

beforeEach(async () => {
  app = await PromptErrorDriver.start();
});

afterEach(async () => {
  await app.dispose();
});

describe("Pi Chat prompt errors", () => {
  it("shows a prompt setup failure once in the affected conversation", async () => {
    await app.sendPromptWithInvalidSystemSection();

    await app.shouldShowErrorOnce("Invalid system prompt section name: agenticFlow");
    await app.shouldKeepErrorOutOfOtherConversation();
  }, 15000);

  it("continues to show a model failure once", async () => {
    await app.sendPromptWithModelFailure();

    await app.shouldShowErrorOnce("Model failed");
  }, 15000);
});
