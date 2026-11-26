import { execFileSync } from "node:child_process";
import { appendFile, mkdir, unlink, writeFile } from "node:fs/promises";
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
    const gutter=diff.locator("[data-column-number]").first();
    await gutter.evaluate(element=>element.scrollIntoView({block:"center",inline:"nearest"}));
    await gutter.hover();
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
    await card.getByRole("button",{name:"Edit comment",exact:true}).click();
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
    await expect(nav.getByText("Checkout.tsx",{exact:true})).toHaveCSS("font-size","11px");
    await expect(nav.getByRole("button",{name:"Folder src/features/checkout",exact:true}).locator("span").first()).toHaveCSS("font-size","11px");
    await expect(nav.getByRole("button",{name:"Source",exact:true}).locator("strong")).toHaveCSS("font-size","11px");
    const paths = await nav.locator("[aria-pressed]").evaluateAll(buttons=>buttons.map(button=>button.getAttribute("aria-label")));
    expect(paths).toHaveLength(9);
    for (const path of paths) {
      await this.chooseFile(path!);
      await expect(this.page.getByRole("region",{name:"Diff for "+path,exact:true})).toBeVisible();
      const rendered=await this.page.getByRole("region",{name:"All file diffs"}).locator("[data-diff-file]").evaluateAll(sections=>sections.map(section=>section.getAttribute("data-diff-file")));
      const positions=rendered.map(path=>paths.indexOf(path));
      expect(positions).toEqual([...positions].sort((a,b)=>a-b));
    }
    await this.chooseFile(paths[0]!);
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
    await expect(this.page.getByText("9 files changed",{exact:true})).toBeVisible();
    const nav=this.page.getByRole("navigation",{name:"Changed files"});
    const source=nav.getByRole("button",{name:"Source",exact:true});
    if (await source.getAttribute("aria-expanded")==="false") await source.click();
    await expect(nav.locator("[aria-pressed]")).toHaveCount(9);
    await this.chooseFile("src/features/checkout/Checkout.tsx");
    await expect(this.diff("src/features/checkout/Checkout.tsx").locator("[data-line]").first()).toHaveText("new content");
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
  async shouldUseCompactDiffLabels() {
    await expect(this.diff("one.ts").getByRole("button",{name:"Collapse one.ts",exact:true}).getByText("one.ts",{exact:true})).toHaveCSS("font-size","11px");
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
    const diff=this.diff("two.ts");
    await expect(diff.locator("[data-line]").filter({hasText:/^before\s*$/})).toBeVisible();
    await expect(diff.locator("[data-line]").filter({hasText:/^after\s*$/})).toBeVisible();
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
