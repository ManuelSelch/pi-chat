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

  async Type(text: string): Promise<void> { await this.composer.fill(text); }
  async ShouldHaveDraft(text: string): Promise<void> { await expect(this.composer).toHaveValue(text); }
  async ShouldOffer(name: string): Promise<void> {
    const option = this.option(name);
    await expect(option).toBeVisible();
    await expect(option).toContainText(`${name} browser fixture`);
    await expect(option.locator(".mantine-Badge-root")).toHaveText("skill");
  }
  async ShouldNotOffer(name: string): Promise<void> { await expect(this.option(name)).toHaveCount(0); }

  async Select(name: string, via: "Enter" | "Tab" | "mouse" = "Enter"): Promise<void> {
    await this.Type(`/skill:${name}`);
    await this.ShouldOffer(name);
    if (via === "mouse") await this.option(name).click();
    else await this.composer.press(via);
    await this.ShouldHaveDraft(`/skill:${name} `);
  }
  async SubmitTask(task = ""): Promise<void> {
    await this.composer.fill(await this.composer.inputValue() + task);
    await this.composer.press("Enter");
  }
  async DismissMenu(): Promise<void> {
    await this.composer.press("Escape");
    await expect(this.page.getByRole("listbox", { name: "Commands" })).toHaveCount(0);
  }
  async ShouldHaveNoInvocations(): Promise<void> {
    await expect(this.page.getByTestId("skill-invocation")).toHaveCount(0);
  }
  async ShouldHaveInvocation(name: string): Promise<void> {
    const card = this.page.getByTestId("skill-invocation");
    await expect(card).toHaveCount(1);
    await expect(card.locator("summary")).toHaveText(`[skill] ${name}`);
    await expect(card).not.toHaveAttribute("open");
    await expect(card.getByRole("heading")).toHaveCount(0);
  }
  async ExpandInvocation(name: string, instructions: string): Promise<void> {
    const card = this.page.getByTestId("skill-invocation");
    await card.locator("summary").click();
    await expect(card).toHaveAttribute("open");
    await expect(card).toContainText(instructions);
    await expect(card).toContainText(`/skills/${name}/SKILL.md`);
  }
  async ShouldHaveRead(name: string, instructions: string): Promise<void> {
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
  async ShouldNotRequestArguments(): Promise<void> { expect(this.argumentRequests).toBe(0); }
  async ReloadResources(): Promise<void> {
    await this.Type("/reload ");
    await this.composer.press("Enter");
    await expect(this.page.getByText("Session reloaded: extensions, commands, and settings were read again.", { exact: true })).toBeVisible();
  }
  async AttemptSubmit(): Promise<void> { await this.composer.press("Enter"); }
}
