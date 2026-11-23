import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

export class BrowserDiffDriver {
  constructor(private readonly page:Page,private readonly projectPath:string) {}
  async prepareChanges() {
    const git = (...args:string[])=>execFileSync("git",["-C",this.projectPath,"-c","user.name=Test","-c","user.email=test@example.invalid",...args],{stdio:"pipe"});
    await writeFile(join(this.projectPath,".gitignore"),"*\n!.gitignore\n!one.ts\n!two.ts\n");
    await writeFile(join(this.projectPath,"one.ts"),Array.from({length:80},(_,i)=>"before "+i).join("\n")+"\n");
    await writeFile(join(this.projectPath,"two.ts"),"before\n");
    git("add","-A");git("commit","-m","Baseline viewer");git("branch","main");
    await writeFile(join(this.projectPath,"two.ts"),"committed\n");
    git("add","-A");git("commit","-m","Prepare viewer");
    await writeFile(join(this.projectPath,"one.ts"),Array.from({length:80},(_,i)=>"after "+i).join("\n")+"\n");
    await writeFile(join(this.projectPath,"two.ts"),"after\n");
  }
  async open() { await this.page.getByRole("button",{name:"Toggle side panel"}).click(); }
  async close() { await this.page.getByRole("button",{name:"Close side panel"}).click(); }
  async chooseFile(path:string) { await this.page.getByRole("navigation",{name:"Changed files"}).getByRole("button",{name:path,exact:true}).click(); }
  async shouldShowEveryDiff() {
    await expect(this.page.getByRole("region",{name:"Diff for one.ts",exact:true})).toBeVisible();
    await expect(this.page.getByRole("region",{name:"Diff for two.ts",exact:true})).toHaveCount(1);
    await expect(this.page.getByText("2 files changed",{exact:true})).toBeVisible();
  }
  async shouldScrollDiffWithoutScrollingChat() {
    const stream = this.page.getByRole("region",{name:"All file diffs"});
    await stream.hover();
    const before = await this.page.evaluate(()=>window.scrollY);
    await this.page.mouse.wheel(0, 500);
    await expect.poll(()=>stream.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
    expect(await this.page.evaluate(()=>window.scrollY)).toBe(before);
  }
  async shouldKeepSelected(path:string) {
    await expect(this.page.getByRole("navigation",{name:"Changed files"}).getByRole("button",{name:path,exact:true})).toHaveAttribute("aria-pressed","true");
  }
  async shouldLeaveChatUsable() {
    const composer = this.page.getByRole("textbox",{name:"Message Pi",exact:true});
    await composer.fill("Draft beside changes");
    await expect(composer).toHaveValue("Draft beside changes");
    const mainBox = await this.page.getByRole("main").boundingBox();
    const composerBox = await composer.boundingBox();
    const panelBox = await this.page.getByRole("complementary",{name:"Side panel"}).boundingBox();
    expect(mainBox).not.toBeNull();expect(composerBox).not.toBeNull();expect(panelBox).not.toBeNull();
    expect(mainBox!.x+mainBox!.width).toBeLessThanOrEqual(panelBox!.x+1);
    expect(composerBox!.x+composerBox!.width).toBeLessThanOrEqual(panelBox!.x+1);
    await expect(this.page.getByRole("dialog")).toHaveCount(0);
  }
  async selectBranchMode() {
    await this.page.getByRole("combobox",{name:"Comparison mode",exact:true}).click();
    await this.page.getByRole("option",{name:"Branch",exact:true}).click();
  }
  async shouldDefaultToMain() {
    const picker = this.page.getByRole("combobox",{name:"Comparison branch",exact:true});
    await expect(picker).toHaveValue("main");
    await picker.click();
    await expect(this.page.getByRole("option",{name:"feature",exact:true})).toBeVisible();
    await picker.press("Escape");
  }
  async selectCommitMode() {
    await this.page.getByRole("combobox",{name:"Comparison mode",exact:true}).click();
    await this.page.getByRole("option",{name:"Commit",exact:true}).click();
  }
  async shouldShowLatestCommit() {
    await expect(this.page.getByRole("combobox",{name:"Comparison commit",exact:true})).toHaveValue("Prepare viewer");
    const diff = this.page.getByRole("region",{name:"Diff for two.ts",exact:true});
    await expect(diff.getByText("before",{exact:true})).toBeVisible();
    await expect(diff.getByText("committed",{exact:true})).toBeVisible();
    await expect(diff.getByText("after",{exact:true})).toHaveCount(0);
  }
  async shouldShowInitialCommit() {
    const diff = this.page.getByRole("region",{name:"Diff for two.ts",exact:true});
    await expect(diff.getByText("before",{exact:true})).toBeVisible();
    await expect(diff.getByText("after",{exact:true})).toHaveCount(0);
  }
  async chooseBranch(name:string) {
    await this.page.getByRole("combobox",{name:"Comparison mode",exact:true}).click();
    await this.page.getByRole("option",{name:"Branch",exact:true}).click();
    await this.page.getByRole("combobox",{name:"Comparison branch",exact:true}).fill(name);
    await this.page.getByRole("option",{name,exact:true}).click();
  }
  async chooseCommit(subject:string) {
    await this.page.getByRole("combobox",{name:"Comparison commit",exact:true}).click();
    await expect(this.page.getByRole("option",{name:subject,exact:true})).toBeVisible();
    await this.page.getByRole("combobox",{name:"Comparison commit",exact:true}).fill(subject);
    await this.page.getByRole("option",{name:subject,exact:true}).click();
    await expect(this.page.getByRole("combobox",{name:"Comparison commit",exact:true})).toHaveValue(subject);
  }
  async shouldShowBeforeAndAfter() {
    const diff = this.page.getByRole("region",{name:"Diff for two.ts",exact:true});
    await expect(diff.getByText("before",{exact:true})).toBeVisible();
    await expect(diff.getByText("after",{exact:true})).toBeVisible();
  }
  async shouldRememberCommit(subject:string) {
    await expect(this.page.getByRole("combobox",{name:"Comparison mode",exact:true})).toHaveValue("Commit");
    await expect(this.page.getByRole("combobox",{name:"Comparison commit",exact:true})).toHaveValue(subject);
  }
  async useCompactViewport() { await this.page.setViewportSize({width:1000,height:900}); }
  async shouldStackWithoutOverlay() {
    const panel = this.page.getByRole("complementary",{name:"Side panel"});
    await expect(panel).toHaveAttribute("data-stacked","true");
    await expect(panel).toHaveCSS("position","relative");
    await expect(this.page.getByRole("dialog")).toHaveCount(0);
    await expect(this.page.getByRole("textbox",{name:"Message Pi",exact:true})).toBeEnabled();
  }
  async shouldBeClosed() { await expect(this.page.getByRole("complementary",{name:"Side panel"})).toHaveCount(0); }
}
