import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { assembleShowcaseHtml } from "./readme-showcase/assembly.js";
import { resolveNpmCli } from "../src/shared/node/npm-command.js";

// Resolve independently of the invoking shell's cwd. SDK imports happen only AFTER isolation.
const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const outputIndex = process.argv.indexOf("--output");
if (process.argv.includes("--help")) {
  console.log("Usage: npm run capture:readme -- [--output <directory>] [--skip-build]\nDefaults to docs/images/showcase. Requires Playwright Chromium; no provider credentials needed.");
  process.exit(0);
}
if (outputIndex >= 0 && (!process.argv[outputIndex + 1] || process.argv[outputIndex + 1].startsWith("--"))) {
  throw new Error("--output requires a directory");
}
const output = resolve(outputIndex < 0 ? "docs/images/showcase" : process.argv[outputIndex + 1]);
if (!process.argv.includes("--skip-build")) {
  const result = spawnSync(process.execPath, [resolveNpmCli(), "run", "build"], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const agentDir = await mkdtemp(join(tmpdir(), "pi-chat-showcase-agent-"));
process.env.PI_CODING_AGENT_DIR = agentDir;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let app: { dispose(): Promise<void> } | undefined;

try {
  // Reuse the real application/SDK browser driver; only the model boundary is scripted.
  const { PiChatBrowserDriver } = await import("../test/infra/e2e/pi-chat-browser-driver.js");
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1120, height: 780 }, deviceScaleFactor: 2, colorScheme: "dark", reducedMotion: "reduce", locale: "en-US", timezoneId: "UTC" });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(20_000);
  let titleIndex = 0;
  const titles = ["Keyboard shortcuts", "Project navigation", "Review retry behavior"];
  const driver = await PiChatBrowserDriver.start(page, { projectName: "pi-chat-demo", extensions: [pi => {
    const title = titles[titleIndex++] ?? "Demo session";
    pi.on("agent_end", async () => { pi.setSessionName(title); });
  }] });
  app = driver;
  const notes = [
    { prompt: "List the essential keyboard shortcuts.", reply: "## Keyboard shortcuts\n\n- **⌘K** opens commands\n- **⌘⇧O** switches projects and sessions\n- **Escape** stops the current run" },
    { prompt: "Summarize the project navigation workflow.", reply: "## Keep your context\n\nOpen **Projects**, pick a folder, and resume a conversation. Each tab keeps its own persistent Pi session." },
  ];
  for (const response of notes) {
    await driver.Tabs.Create({ responses: [response] });
    await driver.Chat.SendPrompt(response.prompt);
    await driver.Chat.ShouldBeIdle();
    await expect(page.getByRole("heading", { name: response.reply.split("\n")[0].replace("## ", ""), exact: true })).toBeVisible();
  }
  const prompt = "Review the retry strategy and suggest a small, safe fix.";
  const reply = `## Keep retries in the same session

Reuse the session client across retry attempts.

\`\`\`ts
async function sendWithRetry(request: Request) {
  const client = session.client;
  return retry(() => client.send(request), { attempts: 3 });
}
\`\`\`

| Check | Expected behavior |
| :--- | :--- |
| Session identity | Preserved across attempts |
| Retry limit | Three attempts |`;
  await driver.Tabs.Create({
    projectName: "retry-review",
    skills: [{ name: "retry-review", instructions: "# Retry review\n\nCheck session continuity, bounded retries, and error reporting.\n\nKeep the session-bound client outside the retry loop." }],
    responses: [{ prompt, reply, readSkill: "retry-review" }],
  });
  await driver.Chat.SendPrompt(prompt);
  await driver.Chat.ShouldBeIdle();
  await expect(page.getByRole("heading", { name: "Keep retries in the same session" })).toBeVisible();
  await expect(page.getByTestId("tool-card")).toHaveCount(1);
  await expect(page.getByTestId("tool-card")).toHaveClass(/success/);
  await expect(page.locator("pre code .hljs-keyword").first()).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await mkdir(output, { recursive: true });

  const settle = async () => {
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.mouse.move(0, 0);
  };
  const screenshot = async (name: string) => {
    await settle();
    await page.screenshot({ path: join(output, `${name}.png`), animations: "disabled", caret: "hide" });
  };
  // Use the app's own preference rather than editing or redacting screenshot pixels.
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const paths = page.getByRole("switch", { name: "Show folder path in projects panel" });
  await paths.uncheck();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Settings", exact: true })).not.toBeVisible();
  await expect(page.getByTestId("tool-card")).toBeVisible();
  await screenshot("workspace");

  await driver.Projects.Open();
  await expect(page.getByRole("dialog", { name: "Projects", exact: true })).toContainText("Review retry behavior");
  const projectPanel = page.getByRole("dialog", { name: "Projects", exact: true });
  const collapsedProjects = projectPanel.locator('button[aria-expanded="false"]');
  const collapsedCount = await collapsedProjects.count();
  for (let index = 0; index < collapsedCount; index++) {
    await collapsedProjects.first().click();
  }
  await settle();
  await page.getByRole("dialog", { name: "Projects", exact: true }).screenshot({ path: join(output, "projects.png"), animations: "disabled", caret: "hide" });
  await driver.Projects.Close();

  await page.setViewportSize({ width: 520, height: 780 });
  await page.locator("body").press("Meta+o");
  const switcher = page.getByRole("dialog");
  const search = page.getByRole("textbox", { name: "Search folders, worktrees, sessions and actions" });
  await expect(search).toBeFocused();
  // A populated Sessions scope shows clean project names without temporary folder paths.
  await switcher.getByRole("button", { name: "@ Sessions", exact: true }).click();
  const options = switcher.getByRole("option");
  await expect(options).toHaveCount(3);
  await expect(options.filter({ hasText: "Review retry behavior" })).toBeVisible();
  const list = switcher.getByRole("listbox");
  const listBox = await list.boundingBox();
  const lastOptionBox = await options.last().boundingBox();
  if (!listBox || !lastOptionBox || lastOptionBox.y + lastOptionBox.height > listBox.y + listBox.height) {
    throw new Error("Quick Switcher must show every session without clipping");
  }
  await settle();
  await switcher.screenshot({ path: join(output, "quick-switcher.png"), animations: "disabled", caret: "hide" });
  await search.press("Escape");
  await expect(switcher).not.toBeVisible();
  await page.setViewportSize({ width: 1120, height: 780 });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-mantine-color-scheme", "light");
  await screenshot("light");
  if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);

  const captures = {
    workspace: (await readFile(join(output, "workspace.png"))).toString("base64"),
    projects: (await readFile(join(output, "projects.png"))).toString("base64"),
    switcher: (await readFile(join(output, "quick-switcher.png"))).toString("base64"),
    light: (await readFile(join(output, "light.png"))).toString("base64"),
  };
  const html = assembleShowcaseHtml(captures);
  const assembly = await context.newPage();
  await assembly.setContent(html, { waitUntil: "load" });
  await assembly.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
  });
  await expect(assembly.locator(".switcher img")).toHaveCSS("object-fit", "contain");
  await assembly.locator(".showcase").screenshot({ path: join(output, "pi-chat-showcase.png"), animations: "disabled" });
  await writeFile(join(output, "preview.html"), html);
  await writeFile(join(output, "manifest.json"), JSON.stringify({
    layout: "Product first", mockModel: true, realUI: true, viewport: { width: 1120, height: 780 }, deviceScaleFactor: 2,
    files: ["workspace.png", "projects.png", "quick-switcher.png", "light.png", "pi-chat-showcase.png", "preview.html"],
  }, null, 2) + "\n");
  console.log(`Showcase written to ${output}\nREADME: ![Pi Chat workspace, projects, Quick Switcher, and light mode](./docs/images/showcase/pi-chat-showcase.png)`);
} finally {
  // Attempt every cleanup even if another one fails. Never touches the user's server.
  try { await app?.dispose(); }
  finally {
    try { await browser?.close(); }
    finally { await rm(agentDir, { recursive: true, force: true }); }
  }
}
