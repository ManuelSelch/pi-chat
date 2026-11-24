import { execFileSync } from "node:child_process";
import { appendFile, mkdir, unlink, writeFile } from "node:fs/promises";
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
  async prepareGroupedChanges() {
    await this.prepareChanges();
    await appendFile(join(this.projectPath,".gitignore"),"!src/\n!src/**\n!tests/\n!tests/**\n!docs/\n!docs/**\n!package.json\n");
    const paths = ["src/features/checkout/Checkout.tsx","src/features/checkout/__tests__/Checkout.test.tsx","src/styles/global.css","tests/e2e/checkout.spec.ts","docs/checkout.md","package.json"];
    for (const path of paths) {
      await mkdir(join(this.projectPath,path,".."),{recursive:true});
      await writeFile(join(this.projectPath,path),path.endsWith(".json") ? "{}\n" : "new content\n");
    }
  }
  async shouldGroupByKind() {
    const nav = this.page.getByRole("navigation",{name:"Changed files"});
    for (const name of ["Source","Tests","Docs","Config"]) await expect(nav.getByRole("button",{name,exact:true})).toHaveAttribute("aria-expanded","true");
    await expect(nav.getByRole("button",{name:"Folder src/features/checkout",exact:true})).toBeVisible();
    await expect(nav.getByRole("button",{name:"src/styles/global.css",exact:true})).toBeVisible();
    await expect(nav.getByText("Files",{exact:true})).toHaveCount(0);
    const paths = await nav.locator("[aria-pressed]").evaluateAll(buttons=>buttons.map(button=>button.getAttribute("aria-label")));
    const diffs = await this.page.getByRole("region",{name:"All file diffs"}).locator("[data-diff-file]").evaluateAll(sections=>sections.map(section=>section.getAttribute("data-diff-file")));
    expect(paths).toEqual(diffs);
  }
  async collapseSourceGroup() {
    await this.page.getByRole("navigation",{name:"Changed files"}).getByRole("button",{name:"Source",exact:true}).click();
  }
  async shouldCollapseNavigationOnly() {
    const nav = this.page.getByRole("navigation",{name:"Changed files"});
    await expect(nav.getByRole("button",{name:"src/features/checkout/Checkout.tsx",exact:true})).toHaveCount(0);
    await expect(this.page.getByRole("region",{name:"Diff for src/features/checkout/Checkout.tsx",exact:true})).toHaveCount(1);
    await expect(this.page.getByText("9 files changed",{exact:true})).toBeVisible();
    await expect(nav.getByRole("button",{name:"src/features/checkout/__tests__/Checkout.test.tsx",exact:true})).toBeVisible();
  }
  async filterFiles(query:string) {
    await this.page.getByRole("textbox",{name:"Filter files by path"}).fill(query);
  }
  async shouldShowFilteredCheckoutChanges() {
    const stream = this.page.getByRole("region",{name:"All file diffs"});
    await expect(stream.locator("[data-diff-file]")).toHaveCount(4);
    await expect(this.page.getByText("4 files changed",{exact:true})).toBeVisible();
    await expect(this.page.getByRole("button",{name:"src/styles/global.css",exact:true})).toHaveCount(0);
    await expect(this.page.getByRole("region",{name:"Diff for src/styles/global.css",exact:true})).toHaveCount(0);
  }
  async shouldKeepUnmatchedFilterUsable() {
    await expect(this.page.getByRole("textbox",{name:"Filter files by path"})).toBeVisible();
    await expect(this.page.getByRole("status")).toHaveText("No matching diffs");
    await expect(this.page.getByText("0 files changed",{exact:true})).toBeVisible();
  }
  async shouldRestoreAllGroupedChanges() {
    await expect(this.page.getByRole("region",{name:"All file diffs"}).locator("[data-diff-file]")).toHaveCount(9);
    await expect(this.page.getByText("9 files changed",{exact:true})).toBeVisible();
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
  async prepareManyChanges() {
    await this.prepareChanges();
    await appendFile(join(this.projectPath,".gitignore"),"!perf-*.ts\n!zz-generated.ts\n");
    await Promise.all(Array.from({length:24},(_,index)=>writeFile(
      join(this.projectPath,"perf-"+String(index).padStart(2,"0")+".ts"),
      Array.from({length:60},(_,line)=>'export const value'+line+' = "example";').join("\n")+"\n",
    )));
    await writeFile(join(this.projectPath,"zz-generated.ts"),Array.from({length:2200},(_,line)=>"export const generated"+line+" = "+line+";").join("\n")+"\n");
  }
  async shouldDeferOffscreenHighlighting() {
    const offscreen = this.page.getByRole("region",{name:"Diff for perf-23.ts",exact:true});
    await expect(offscreen).toHaveCount(1);
    await expect(offscreen.locator(".hljs-keyword")).toHaveCount(0);
  }
  async shouldHighlightSelectedFile() {
    const selected = this.page.getByRole("region",{name:"Diff for perf-00.ts",exact:true});
    await expect(selected.locator(".hljs-keyword").first()).toBeVisible();
  }
  async shouldKeepGeneratedFileReadable() {
    const generated = this.page.getByRole("region",{name:"Diff for zz-generated.ts",exact:true});
    await expect(generated.locator("code")).toHaveCount(2200);
    await expect(generated.locator(".hljs-keyword")).toHaveCount(0);
    await expect(generated.locator("code").last()).toHaveText("export const generated2199 = 2199;");
    const composer = this.page.getByRole("textbox",{name:"Message Pi",exact:true});
    const start = Date.now();
    await composer.fill("Responsive with large changes");
    await expect(composer).toHaveValue("Responsive with large changes");
    expect(Date.now()-start).toBeLessThan(1500);
  }
  async shouldScrollLargeDiffSmoothly() {
    const stream = this.page.getByRole("region",{name:"All file diffs"});
    const stats = await stream.evaluate(async element=>{
      const frames:number[] = [];
      const start = element.scrollTop;
      let previous = performance.now();
      for (let index=0;index<40;index++) {
        await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
        const now = performance.now();
        frames.push(now-previous);
        previous = now;
        element.scrollTop = start+index*120;
      }
      return {worst:Math.max(...frames),slow:frames.filter(time=>time>100).length};
    });
    console.log("Large diff scroll frames:",JSON.stringify(stats));
    expect(stats.worst).toBeLessThan(500);
    expect(stats.slow).toBeLessThan(4);
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
    await code.scrollIntoViewIfNeeded();
    await expect(code).toHaveCSS("white-space","pre-wrap");
    expect(await code.evaluate(element=>element.getBoundingClientRect().height)).toBeGreaterThan(24);
    expect(await code.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
    await expect(this.page.getByRole("button",{name:"Wrap lines"})).toHaveAttribute("aria-pressed","true");
  }
  async shouldHighlightSyntax() {
    const code = this.page.getByRole("region",{name:"Diff for one.ts",exact:true}).locator("code").filter({hasText:"const longValue"});
    const keyword = code.locator(".hljs-keyword");
    await expect(keyword).toHaveText("const");
    expect(await keyword.evaluate(element=>getComputedStyle(element).color!==getComputedStyle(element.parentElement!).color)).toBe(true);
    await expect(code.locator(".hljs-string")).toContainText("x".repeat(400));
    expect(await code.textContent()).toBe('const longValue = "'+"x".repeat(400)+'";');
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
  async close() { await this.page.getByRole("button",{name:"Toggle side panel"}).click(); }
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
    await this.page.getByRole("button",{name:"Comparison mode",exact:true}).click();
    await this.page.getByRole("menuitem",{name:"Branch",exact:true}).click();
  }
  async shouldDefaultToMain() {
    const picker = this.page.getByRole("button",{name:"Comparison branch",exact:true});
    await expect(picker).toHaveText("Againstmain");
    await picker.click();
    await expect(this.page.getByRole("option",{name:"main",exact:true})).toBeVisible();
    await expect(this.page.getByRole("option",{name:"feature",exact:true})).toHaveCount(0);
    await expect(this.page.getByRole("textbox",{name:"Search all branches",exact:true})).toHaveCount(0);
    await picker.press("Escape");
  }
  async selectCommitMode() {
    await this.page.getByRole("button",{name:"Comparison mode",exact:true}).click();
    await this.page.getByRole("menuitem",{name:"Commit",exact:true}).click();
  }
  async shouldShowLatestCommit() {
    await expect(this.page.getByRole("button",{name:"Comparison commit",exact:true})).toHaveText("Prepare viewer");
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
    await this.selectBranchMode();
    await this.page.getByRole("button",{name:"Comparison branch",exact:true}).click();
    await this.page.getByRole("button",{name:"Search all branches…",exact:true}).click();
    await this.page.getByRole("textbox",{name:"Search all branches",exact:true}).fill(name);
    await this.page.getByRole("option",{name,exact:true}).click();
  }
  async chooseCommit(subject:string) {
    await this.page.getByRole("button",{name:"Comparison commit",exact:true}).click();
    await expect(this.page.getByRole("option",{name:subject,exact:true})).toBeVisible();
    await this.page.getByRole("option",{name:subject,exact:true}).click();
    await expect(this.page.getByRole("button",{name:"Comparison commit",exact:true})).toHaveText(subject);
  }
  async shouldShowBeforeAndAfter() {
    const diff = this.page.getByRole("region",{name:"Diff for two.ts",exact:true});
    await expect(diff.getByText("before",{exact:true})).toBeVisible();
    await expect(diff.getByText("after",{exact:true})).toBeVisible();
  }
  async shouldRememberCommit(subject:string) {
    await expect(this.page.getByRole("button",{name:"Comparison mode",exact:true})).toHaveText("Commit");
    await expect(this.page.getByRole("button",{name:"Comparison commit",exact:true})).toHaveText(subject);
  }
  async preparePickerChoices() {
    await this.prepareChanges();
    const git = (...args:string[])=>execFileSync("git",["-C",this.projectPath,"-c","user.name=Test","-c","user.email=test@example.invalid",...args],{stdio:"pipe"});
    git("branch","unrelated","main");
    for (let index=1;index<=6;index++) git("commit","--allow-empty","-m","Recent change "+index);
    git("branch","parent","HEAD~2");
  }
  async shouldSearchBranchesWithKeyboard() {
    const trigger = this.page.getByRole("button",{name:"Comparison branch",exact:true});
    await expect(trigger).toHaveText("Againstmain");
    await trigger.click();
    await expect(this.page.getByRole("option",{name:"parent",exact:true})).toBeVisible();
    await expect(this.page.getByRole("option",{name:"unrelated",exact:true})).toHaveCount(0);
    await this.page.getByRole("button",{name:"Search all branches…",exact:true}).click();
    const search = this.page.getByRole("textbox",{name:"Search all branches",exact:true});
    await expect(search).toBeFocused();
    await search.fill("no-such-branch");
    await expect(this.page.getByText("No matching branches",{exact:true})).toBeVisible();
    await expect(trigger).toHaveText("Againstmain");
    await this.page.getByRole("button",{name:"Back to suggestions",exact:true}).click();
    await expect(search).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await this.page.getByRole("button",{name:"Search all branches…",exact:true}).click();
    await search.fill("unrelated");
    await search.press("ArrowDown");
    await search.press("Enter");
    await expect(trigger).toHaveText("Againstunrelated");
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(this.page.getByRole("option",{name:"unrelated",exact:true})).toBeVisible();
    await trigger.press("Escape");
    await expect(this.page.getByRole("option",{name:"unrelated",exact:true})).toBeHidden();
  }
  async shouldOfferOnlyFiveRecentCommits() {
    const trigger = this.page.getByRole("button",{name:"Comparison commit",exact:true});
    await expect(trigger).toHaveText("Recent change 6");
    await trigger.click();
    await expect(this.page.getByRole("option")).toHaveCount(5);
    await expect(this.page.getByRole("option",{name:"Recent change 2",exact:true})).toBeVisible();
    await expect(this.page.getByRole("option",{name:"Recent change 1",exact:true})).toHaveCount(0);
    await expect(this.page.getByRole("textbox",{name:/Search.*commits/})).toHaveCount(0);
    await expect(this.page.getByRole("button",{name:"Older",exact:true})).toHaveCount(0);
    await trigger.press("ArrowDown");
    await trigger.press("Enter");
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveText("Recent change 6");
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
