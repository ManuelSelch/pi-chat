import { execFileSync } from "node:child_process";
import { appendFile, unlink, writeFile } from "node:fs/promises";
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
  async prepareLongAndDeletedChanges() {
    await this.prepareChanges();
    await writeFile(join(this.projectPath,"deleted.ts"),"deleted content\n");
    execFileSync("git",["-C",this.projectPath,"add","-f","deleted.ts"]);
    execFileSync("git",["-C",this.projectPath,"-c","user.name=Test","-c","user.email=test@example.invalid","commit","-m","Track deleted fixture"],{stdio:"pipe"});
    execFileSync("git",["-C",this.projectPath,"branch","-f","main","HEAD"],{stdio:"pipe"});
    await unlink(join(this.projectPath,"deleted.ts"));
    await appendFile(join(this.projectPath,"one.ts"),"const longValue = \""+"x".repeat(400)+"\";\n");
  }
  async shouldPlaceToggleLast() {
    const plus = this.page.getByRole("button",{name:"New session",exact:true});
    const toggle = this.page.getByRole("button",{name:"Toggle side panel"});
    const plusBox = await plus.boundingBox();
    const toggleBox = await toggle.boundingBox();
    expect(plusBox).not.toBeNull();
    expect(toggleBox).not.toBeNull();
    expect(toggleBox!.x).toBeGreaterThan(plusBox!.x);
  }
  async shouldWrapLongLines() {
    const diff = this.page.getByRole("region",{name:"Diff for one.ts",exact:true});
    const code = diff.locator("code").filter({hasText:"const longValue"});
    await expect(code).toHaveCSS("white-space","pre-wrap");
    expect(await code.evaluate(element=>element.getBoundingClientRect().height)).toBeGreaterThan(24);
    expect(await code.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
    await expect(this.page.getByRole("button",{name:"Wrap lines"})).toHaveAttribute("aria-pressed","true");
  }
  async toggleWrapping() { await this.page.getByRole("button",{name:"Wrap lines"}).click(); }
  async shouldScrollWithConsistentBackgrounds() {
    const diff = this.page.getByRole("region",{name:"Diff for one.ts",exact:true});
    const code = diff.locator("code").filter({hasText:"const longValue"});
    await expect(code).toHaveCSS("white-space","pre");
    const dimensions = await code.evaluate(element=>{
      const row = element.parentElement!;
      const lines = row.parentElement!;
      const scroll = lines.parentElement!;
      const short = Array.from(lines.children).find(child=>child.querySelector("code")?.textContent==="after 0")!;
      scroll.scrollLeft=100;
      const gutter = row.firstElementChild!;
      return {
        overflow:scroll.scrollWidth>scroll.clientWidth,
        rowWidth:row.getBoundingClientRect().width,
        shortWidth:short.getBoundingClientRect().width,
        background:getComputedStyle(row).backgroundColor,
        gutterBackground:getComputedStyle(gutter).backgroundColor,
        gutterX:gutter.getBoundingClientRect().left,
        viewportX:scroll.getBoundingClientRect().left,
      };
    });
    expect(dimensions.overflow).toBe(true);
    expect(dimensions.rowWidth).toBeCloseTo(dimensions.shortWidth,0);
    expect(dimensions.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(dimensions.gutterBackground).toBe(dimensions.background);
    expect(dimensions.gutterX).toBeCloseTo(dimensions.viewportX,0);
  }
  async shouldCollapseDeletedFile() {
    const diff = this.page.getByRole("region",{name:"Diff for deleted.ts",exact:true});
    await expect(diff.getByText("deleted content",{exact:true})).toHaveCount(0);
    await expect(diff.getByRole("button",{name:"Expand deleted.ts"})).toHaveAttribute("aria-expanded","false");
  }
  async expandDeletedFileWithKeyboard() {
    const heading = this.page.getByRole("button",{name:"Expand deleted.ts"});
    await heading.focus();
    await heading.press("Enter");
    await expect(this.page.getByRole("region",{name:"Diff for deleted.ts",exact:true}).getByText("deleted content",{exact:true})).toBeVisible();
  }
  async shouldHaveNoTooltips() {
    const panel = this.page.getByRole("complementary",{name:"Side panel"});
    await expect(panel.locator("[title]")).toHaveCount(0);
    await expect(panel.getByRole("tooltip")).toHaveCount(0);
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
  async shouldShowFullWidthView() {
    const panel = this.page.getByRole("complementary",{name:"Side panel"});
    await expect(panel).toHaveAttribute("data-stacked","true");
    await expect(panel).toHaveCSS("position","fixed");
    await expect(this.page.getByRole("dialog")).toHaveCount(0);
    await expect(this.page.getByRole("textbox",{name:"Message Pi",exact:true})).toHaveCount(0);
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeCloseTo(this.page.viewportSize()!.height, 0);
  }
  async shouldBeUnavailable() {
    await expect(this.page.getByRole("button",{name:"Toggle side panel"})).toHaveCount(0);
    await this.shouldBeClosed();
  }
  async shouldBeAvailableAndClosed() {
    await expect(this.page.getByRole("button",{name:"Toggle side panel"})).toHaveAttribute("aria-expanded","false");
    await this.shouldBeClosed();
  }
  async shouldBeClosed() { await expect(this.page.getByRole("complementary",{name:"Side panel"})).toHaveCount(0); }
}
