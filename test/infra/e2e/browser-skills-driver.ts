import { expect, type Locator, type Page } from "@playwright/test";

/** Skill workflows through the visible composer and transcript, not runtime history. */
export class BrowserSkillsDriver {
  private argumentRequests = 0;
  constructor(private readonly page: Page, private readonly composer: Locator) {
    page.on("websocket", socket => socket.on("framesent", ({ payload }) => {
      const message = JSON.parse(payload.toString()) as { type: string };
      if (message.type === "completeCommandArguments") this.argumentRequests++;
    }));
  }

  private option(name: string): Locator {
    return this.page.getByRole("option").filter({ hasText: `/skill:${name}` });
  }

  async type(text: string): Promise<void> { await this.composer.fill(text); }
  async shouldHaveDraft(text: string): Promise<void> { await expect(this.composer).toHaveValue(text); }
  async shouldOffer(name: string): Promise<void> {
    const option = this.option(name);
    await expect(option).toBeVisible();
    await expect(option).toContainText(`${name} browser fixture`);
    await expect(option.locator(".mantine-Badge-root")).toHaveText("skill");
  }
  async shouldNotOffer(name: string): Promise<void> { await expect(this.option(name)).toHaveCount(0); }

  async select(name: string, via: "Enter" | "Tab" | "mouse" = "Enter"): Promise<void> {
    await this.type(`/skill:${name}`);
    await this.shouldOffer(name);
    if (via === "mouse") await this.option(name).click();
    else await this.composer.press(via);
    await this.shouldHaveDraft(`/skill:${name} `);
  }
  async submitTask(task = ""): Promise<void> {
    await this.composer.fill(await this.composer.inputValue() + task);
    await this.composer.press("Enter");
  }
  async dismissMenu(): Promise<void> {
    await this.composer.press("Escape");
    await expect(this.page.getByRole("listbox", { name: "Commands" })).toHaveCount(0);
  }
  async shouldHaveQueuedInvocation(name: string, instructions: string, task: string): Promise<void> {
    const panel = this.page.getByRole("region", { name: "Queued steering" });
    await expect(panel.getByRole("listitem")).toHaveCount(1);
    await expect(panel).toContainText(`<skill name="${name}"`);
    await expect(panel).toContainText(instructions);
    await expect(panel).toContainText(task);
    await this.shouldHaveDraft("");
  }
  async shouldHaveNoInvocations(): Promise<void> {
    await expect(this.page.getByTestId("skill-invocation")).toHaveCount(0);
  }
  async shouldHaveInvocation(name: string): Promise<void> {
    const card = this.page.getByTestId("skill-invocation");
    await expect(card).toHaveCount(1);
    await expect(card.locator("summary")).toHaveText(`[skill] ${name}`);
    await expect(card).not.toHaveAttribute("open");
    await expect(card.getByRole("heading")).toHaveCount(0);
  }
  async expandInvocation(name: string, instructions: string): Promise<void> {
    const card = this.page.getByTestId("skill-invocation");
    await card.locator("summary").click();
    await expect(card).toHaveAttribute("open");
    await expect(card).toContainText(instructions);
    await expect(card).toContainText(`/skills/${name}/SKILL.md`);
  }
  async shouldHaveRead(name: string, instructions: string): Promise<void> {
    // Compact transcript is the default, so tool cards render inside a collapsed
    // "Used …" group; expand it before interacting with the inner card.
    const group = this.page.getByTestId("tool-group");
    if (await group.count()) await group.locator("> summary").click();
    const card = this.page.getByTestId("tool-card");
    await expect(card).toHaveCount(1);
    await expect(card.locator("summary")).toHaveText(`[skill]${name}`);
    await expect(card).not.toHaveAttribute("open");
    await expect(card).toHaveClass(/success/);
    await card.locator("summary").click();
    await expect(card).toHaveAttribute("open");
    await expect(card).toContainText(`/skills/${name}/SKILL.md`);
    await expect(card).toContainText(instructions);
  }
  async shouldNotRequestArguments(): Promise<void> { expect(this.argumentRequests).toBe(0); }
  async reloadResources(): Promise<void> {
    await this.type("/reload ");
    await this.composer.press("Enter");
    await expect(this.page.getByText("Session reloaded: extensions, commands, and settings were read again.", { exact: true })).toBeVisible();
  }
  async attemptSubmit(): Promise<void> { await this.composer.press("Enter"); }
}
