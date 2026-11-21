import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager, type AgentSessionRuntime } from "@earendil-works/pi-coding-agent";
import type { UiPrompt } from "@manuelselch/pi-sdk/protocol";
import { PiRuntimeAdapter } from "../../src/runtime/pi/pi-runtime-adapter.js";

/** Real Pi runner, resources and extension; no model or credentials are used. */
export class PromptPresentationDriver {
  readonly requests: UiPrompt[] = [];
  private adapter?: PiRuntimeAdapter;
  private dir?: string;

  async runQuestionAndReasoning(): Promise<void> {
    this.dir = await mkdtemp(join(tmpdir(), "pi-presented-prompts-"));
    const path = join(this.dir, "extension.ts");
    await writeFile(path, `export default pi => {
      pi.registerCommand("present", { handler: async (_, ctx) => {
        await ctx.ui.withPromptPresentation({ body: { format: "markdown", text: "**Question**" }, submission: "explicit" }, () => ctx.ui.select("Check", ["A", "B"]));
        await ctx.ui.withPromptPresentation({ body: { format: "plain", text: "Why?" }, submitLabel: "Submit answer" }, () => ctx.ui.editor("Explain", ""));
      } });
    }`);
    const settingsManager = SettingsManager.inMemory();
    const loader = new DefaultResourceLoader({ cwd: this.dir, agentDir: this.dir, settingsManager, additionalExtensionPaths: [path], noSkills: true, noThemes: true, noPromptTemplates: true });
    await loader.reload();
    const { session } = await createAgentSession({ cwd: this.dir, agentDir: this.dir, settingsManager, resourceLoader: loader, sessionManager: SessionManager.inMemory(this.dir) });
    this.adapter = PiRuntimeAdapter.fromRuntime({ session, cwd: this.dir, dispose: async () => session.dispose() } as AgentSessionRuntime);
    this.adapter.subscribe(event => {
      if (event.type !== "prompts") return;
      const prompt = event.prompts.at(-1);
      if (!prompt || this.requests.some(previous => previous.id === prompt.id)) return;
      this.requests.push(prompt);
      this.adapter!.respondToPrompt(prompt.id, { cancelled: false, value: prompt.kind === "select" ? "A" : "" });
    });
    await (this.adapter as unknown as { startExtensions(): Promise<void> }).startExtensions();
    await this.adapter.prompt("/present");
  }

  async dispose(): Promise<void> {
    await this.adapter?.dispose();
    if (this.dir) await rm(this.dir, { recursive: true, force: true });
  }
}
