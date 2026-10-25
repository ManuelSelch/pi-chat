import { afterEach, expect, it } from "vitest";
import { WidgetExtensionFixture } from "../../infra/pi-chat/fixtures/widget-extension-fixture.js";
import { TestWorld } from "../../infra/pi-chat/test-world.js";

const worlds: TestWorld[] = [];
afterEach(async () => { await Promise.all(worlds.splice(0).map(world => world.dispose())); });
function setup() {
  const fixture = new WidgetExtensionFixture();
  const world = new TestWorld([fixture.extension]);
  worlds.push(world);
  return { fixture, world };
}

it("publishes explicit widget inputs using the real session UI, without registering commands", async () => {
  const { fixture, world } = setup();
  const runtime = await world.create([]);
  expect(runtime.snapshot().actions.commands.map(command => command.name)).not.toContain("widget-show");
  fixture.setWidget("custom", { text: "Ready", foreground: "success", bold: true });
  const widget = runtime.snapshot().widgets[0]!;
  expect(widget.key).toBe("custom");
  expect(widget.lines[0]).toContain("Ready");
  expect(widget.lines[0]).toContain("\u001b[1m");
  expect(widget.lines[0]).toContain("\u001b[38;2;");
  fixture.setWidget("custom", [
    { text: "Ready", foreground: "error", italic: true },
    { text: "  next\nline 😀", foreground: [12, 34, 56] },
  ]);
  expect(runtime.snapshot().widgets[0]!.lines[0]).not.toBe(widget.lines[0]);
  expect(runtime.snapshot().widgets[0]!.lines[1]).toContain("\u001b[38;2;12;34;56m");
  fixture.clearWidget("custom");
  expect(runtime.snapshot().widgets).toEqual([]);
});

it("refuses missing or ambiguous sessions instead of targeting an arbitrary runtime", async () => {
  const { fixture, world } = setup();
  expect(() => fixture.setWidget("status", { text: "Ready" })).toThrow("exactly one live test session");
  const first = await world.create([]);
  const second = await world.create([]);
  expect(() => fixture.setWidget("status", { text: "Ready" })).toThrow("exactly one live test session");
  expect(first.snapshot().widgets).toEqual([]);
  expect(second.snapshot().widgets).toEqual([]);
  await second.dispose();
  fixture.setWidget("status", { text: "Ready" });
  expect(first.snapshot().widgets[0]!.lines).toEqual(["Ready"]);
  await first.dispose();
  expect(() => fixture.clearWidget("status")).toThrow("exactly one live test session");
});

it("isolates extension controls between application fixtures", async () => {
  const first = setup();
  const second = setup();
  const one = await first.world.create([]);
  const two = await second.world.create([]);
  first.fixture.setWidget("only-first", { text: "one" });
  expect(one.snapshot().widgets[0]!.key).toBe("only-first");
  expect(two.snapshot().widgets).toEqual([]);
});
