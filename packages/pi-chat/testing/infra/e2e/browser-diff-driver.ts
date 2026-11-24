import { execFileSync } from "node:child_process";
import { appendFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

export class BrowserDiffDriver {
  private readonly workers:string[]=[];
  constructor(private readonly page:Page,private readonly projectPath:string) { page.on("worker",worker=>this.workers.push(worker.url())); }
  private diff(path:string) { return this.page.locator("diffs-container").filter({has:this.page.locator("[data-diff-file]").filter({has:this.page.getByText(path,{exact:true})})}); }
  private stream() { return this.page.getByRole("region",{name:"All file diffs"}).locator(":scope > div").first(); }
  private async revealEndLine(path:string,text:string) {
    const line=this.diff(path).locator("[data-line]").filter({hasText:text});
    await expect.poll(async()=>{await this.stream().evaluate(element=>{element.scrollTop=element.scrollHeight;});return line.isVisible();}).toBe(true);
    return line;
  }
  async shouldUseBundledWorkers() { expect(this.workers.some(url=>url.includes("diff.worker"))).toBe(true); }
  async expectedReviewBatch() {
    const sha=execFileSync("git",["-C",this.projectPath,"merge-base","HEAD","main"],{encoding:"utf8"}).trim();
    return 'Please address these diff review comments.\nComparison: refs/heads/main\n\n"one.ts":1 (old)\nBase: '+sha+'\n> before 0\nHandle the empty case.\n\n"two.ts":1 (old)\nBase: '+sha+'\n> before\nKeep validation.';
  }
  async beginCommentDraft(path:string,body:string) {
    await this.chooseFile(path);
    await this.page.getByRole("button",{name:"Comment on "+path,exact:true}).click();
    await this.page.getByRole("textbox",{name:"Review comment"}).fill(body);
  }
  async shouldHaveCommentDraft(body:string) { await expect(this.page.getByRole("textbox",{name:"Review comment"})).toHaveValue(body); }
  async cancelComment() { await this.page.getByRole("button",{name:"Cancel comment"}).click(); }
  async addLineComment(path:string,body:string) {
    await this.chooseFile(path);
    const diff=this.diff(path);
    await diff.locator("[data-column-number]").first().hover();
    await diff.getByRole("button",{name:"Add line comment",exact:true}).click();
    const editor=this.page.getByRole("textbox",{name:"Review comment"});
    await editor.fill(body);
    await this.page.getByRole("button",{name:"Save comment",exact:true}).click();
    await expect(this.page.getByRole("textbox",{name:"Review comment"})).toHaveCount(0);
    await expect(diff.getByText(body,{exact:true})).toBeVisible();
    await this.page.getByRole("tab",{name:"Changes",exact:true}).hover();
    await expect(diff.getByRole("button",{name:"Add line comment",exact:true})).not.toBeVisible();
  }
  async editComment(original:string,replacement:string) {
    const card=this.page.getByText(original,{exact:true}).locator("..");
    await card.getByRole("button",{name:"Edit",exact:true}).click();
    await this.page.getByRole("textbox",{name:"Review comment"}).fill(replacement);
    await this.page.getByRole("textbox",{name:"Review comment"}).press("Control+Enter");
    await expect(this.page.getByText(replacement,{exact:true})).toBeVisible();
  }
  async shouldHaveComments(count:number) {
    await expect(this.page.getByText(count+" comments",{exact:true})).toBeVisible();
  }
  async sendComments() { await this.page.getByRole("button",{name:"Send comments",exact:true}).click(); }
  async shouldClearSubmittedComments() { await expect(this.page.getByRole("button",{name:"Send comments",exact:true})).toHaveCount(0); }
  async shouldShowBatchOnce(text:string) {
    const batch=this.page.locator("[data-pi-user-message]").filter({hasText:"Please address these diff review comments."});
    await expect(batch).toHaveCount(1);
    for (const line of text.split("\n").filter(Boolean)) await expect(batch).toContainText(line.replace(/^> /,""));
  }


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
    await appendFile(join(this.projectPath,"one.ts"),"const longValue = \""+"x".repeat(400)+"\";\n"+'const html = "<script>window.diffInjected=true</script>";\n');
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
    await expect(this.page.getByRole("navigation",{name:"Changed files"}).getByRole("button",{name:"perf-23.ts",exact:true})).toBeVisible();
    await expect(this.diff("perf-23.ts").locator("[data-line]")).toHaveCount(0);
  }
  async shouldHighlightSelectedFile() {
    const keyword=this.diff("perf-00.ts").locator('[data-line] span').filter({hasText:/^export$/}).first();
    await expect(keyword).toBeVisible();
    await expect.poll(()=>keyword.evaluate(element=>getComputedStyle(element).color!==getComputedStyle(element.parentElement!).color)).toBe(true);
  }
  async shouldKeepGeneratedFileReadable() {
    const generated=this.diff("zz-generated.ts");
    await expect(generated.locator("[data-line]").first()).toContainText("generated0");
    expect(await generated.locator("[data-line]").count()).toBeLessThan(300);
    await this.stream().evaluate(element=>{element.scrollTop=element.scrollHeight;});
    await expect(generated.locator("[data-line]").last()).toContainText("generated2199");
    const composer=this.page.getByRole("textbox",{name:"Message Pi",exact:true});
    const start=Date.now();
    await composer.fill("Responsive with large changes");
    await expect(composer).toHaveValue("Responsive with large changes");
    expect(Date.now()-start).toBeLessThan(1500);
  }
  async shouldScrollLargeDiffSmoothly() {
    const stream = this.stream();
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
    await this.chooseFile("one.ts");
    const code=await this.revealEndLine("one.ts","const longValue");
    await expect(code).toHaveCSS("white-space","pre-wrap");
    expect(await code.evaluate(element=>element.getBoundingClientRect().height)).toBeGreaterThan(24);
    expect(await code.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
    await expect(this.page.getByRole("button",{name:"Wrap lines"})).toHaveAttribute("aria-pressed","true");
  }
  async shouldHighlightSyntax() {
    const code=this.diff("one.ts").locator("[data-line]").filter({hasText:"const longValue"});
    const keyword=code.locator("span").filter({hasText:/^const$/});
    await expect(keyword).toHaveText("const");
    await expect.poll(()=>keyword.evaluate(element=>getComputedStyle(element).color!==getComputedStyle(element.parentElement!).color)).toBe(true);
    await expect(code).toHaveText('const longValue = "'+"x".repeat(400)+'";');
  }
  async toggleWrapping() { await this.page.getByRole("button",{name:"Wrap lines"}).click(); }
  async shouldScrollWithConsistentBackgrounds() {
    const diff=this.diff("one.ts");
    const code=diff.locator("[data-line]").filter({hasText:"const longValue"});
    await expect(code).toHaveCSS("white-space","pre");
    const columns=diff.locator("[data-code]").first();
    await expect.poll(()=>columns.evaluate(element=>element.scrollWidth>element.clientWidth)).toBe(true);
    await columns.evaluate(element=>{element.scrollLeft=100;});
    const gutter=diff.locator("[data-gutter]").first();
    const before=await gutter.boundingBox();
    await columns.evaluate(element=>{element.scrollLeft=200;});
    const after=await gutter.boundingBox();
    expect(before).not.toBeNull();expect(after).not.toBeNull();
    expect(after!.x).toBeCloseTo(before!.x,0);
    const background=await code.evaluate(element=>getComputedStyle(element).backgroundColor);
    expect(background).not.toBe("rgba(0, 0, 0, 0)");
    const row=diff.locator('[data-column-number][data-line-type="change-addition"]').last();
    await expect(row).toHaveCSS("background-color",background);
  }
  async shouldCollapseDeletedFile() {
    await this.chooseFile("deleted.ts");
    const diff=this.diff("deleted.ts");
    await expect(diff.getByText("deleted content",{exact:true})).toHaveCount(0);
    await expect(diff.getByRole("button",{name:"Expand deleted.ts"})).toHaveAttribute("aria-expanded","false");
  }
  async expandDeletedFileWithKeyboard() {
    const heading=this.page.getByRole("button",{name:"Expand deleted.ts"});
    await heading.focus();await heading.press("Enter");
    await expect(this.diff("deleted.ts").locator("[data-line]").filter({hasText:"deleted content"})).toBeVisible();
  }
  async shouldHaveNoTooltips() {
    const panel = this.page.getByRole("complementary",{name:"Side panel"});
    await expect(panel.locator("[title]")).toHaveCount(0);
    await expect(panel.getByRole("tooltip")).toHaveCount(0);
  }
  async shouldRenderHtmlSafely() {
    await this.chooseFile("one.ts");
    const line=await this.revealEndLine("one.ts","window.diffInjected=true");
    await expect(line).toContainText("<script>window.diffInjected=true</script>");
    expect(await this.page.evaluate(()=>Object.hasOwn(window,"diffInjected"))).toBe(false);
  }
  async open() { await this.page.getByRole("button",{name:"Toggle side panel"}).click(); }
  async close() { await this.page.getByRole("button",{name:"Toggle side panel"}).click(); }
  async chooseFile(path:string) { await this.page.getByRole("navigation",{name:"Changed files"}).getByRole("button",{name:path,exact:true}).click(); }
  async shouldShowEveryDiff() {
    await expect(this.page.getByRole("navigation",{name:"Changed files"}).getByRole("button",{name:"one.ts",exact:true})).toBeVisible();
    await expect(this.page.getByRole("navigation",{name:"Changed files"}).getByRole("button",{name:"two.ts",exact:true})).toBeVisible();
    await expect(this.diff("one.ts").locator("[data-line]").first()).toBeVisible();
    await expect(this.page.getByText("2 files changed",{exact:true})).toBeVisible();
  }
  async shouldScrollDiffWithoutScrollingChat() {
    const stream=this.stream();
    await stream.hover();
    const before=await this.page.evaluate(()=>window.scrollY);
    await this.page.mouse.wheel(0,500);
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
    const diff=this.diff("two.ts");
    await expect(diff.locator("[data-line]").filter({hasText:/^before\s*$/})).toBeVisible();
    await expect(diff.locator("[data-line]").filter({hasText:/^committed\s*$/})).toBeVisible();
    await expect(diff.locator("[data-line]").filter({hasText:/^after\s*$/})).toHaveCount(0);
  }
  async shouldShowInitialCommit() {
    await this.chooseFile("two.ts");
    const diff=this.diff("two.ts");
    await expect(diff.locator("[data-line]").filter({hasText:/^before\s*$/})).toBeVisible();
    await expect(diff.locator("[data-line]").filter({hasText:/^after\s*$/})).toHaveCount(0);
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
    const diff=this.diff("two.ts");
    await expect(diff.locator("[data-line]").filter({hasText:/^before\s*$/})).toBeVisible();
    await expect(diff.locator("[data-line]").filter({hasText:/^after\s*$/})).toBeVisible();
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
