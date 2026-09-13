import { describe, expect, it } from "vitest";
import { commandQuery, filterCommands, menuItems } from "../src/web/commands/command-menu.js";

const commands = [
  { name: "compact", description: "Compact the session" },
  { name: "preview-pdf" },
  { name: "pdf", description: "Convert PDF to text" },
];

describe("commandQuery", () => {
  it("opens on a leading slash", () => {
    expect(commandQuery("/")).toBe("");
    expect(commandQuery("/pd")).toBe("pd");
  });

  it("stays closed for a slash that is not the command position", () => {
    expect(commandQuery("cd /usr")).toBeUndefined();
    expect(commandQuery("what is 3/4")).toBeUndefined();
  });

  it("closes once arguments are being typed", () => {
    expect(commandQuery("/pdf notes.pdf")).toBeUndefined();
    expect(commandQuery("/pdf ")).toBeUndefined();
  });
});

describe("filterCommands", () => {
  it("lists everything for a bare slash", () => {
    expect(filterCommands(commands, "")).toHaveLength(3);
  });

  it("ranks prefix matches before substring matches", () => {
    expect(filterCommands(commands, "pdf").map((command) => command.name)).toEqual(["pdf", "preview-pdf"]);
  });

  it("matches case-insensitively and can come back empty", () => {
    expect(filterCommands(commands, "COMP").map((command) => command.name)).toEqual(["compact"]);
    expect(filterCommands(commands, "nope")).toEqual([]);
  });
});

describe("session actions in the menu", () => {
  const actions = [
    { name: "Rename session", description: "Set the display name", run: () => {} },
    { name: "Close tab", description: "Close this tab", run: () => {} },
  ];

  it("lists session actions before Pi commands", () => {
    const items = menuItems(actions, commands);

    expect(items.map((item) => item.kind)).toEqual(["action", "action", "command", "command", "command"]);
    expect(items[0]!.name).toBe("Rename session");
  });

  it("filters actions and commands together", () => {
    const items = menuItems(actions, commands);

    expect(filterCommands(items, "ren").map((item) => item.name)).toEqual(["Rename session"]);
    expect(filterCommands(items, "c").map((item) => item.name)).toEqual(["Close tab", "compact"]);
  });

  it("keeps each row's kind so selecting one knows what to do", () => {
    const items = menuItems(actions, commands);
    const [action] = filterCommands(items, "close tab");
    const [command] = filterCommands(items, "compact");

    expect(action).toMatchObject({ kind: "action" });
    expect(command).toMatchObject({ kind: "command" });
  });
});

describe("ordering between actions and commands", () => {
  it("keeps a session action above an equally-matching command", () => {
    const items = menuItems(
      [{ name: "Rename session", description: "", run: () => {} }],
      [{ name: "readonly" }, { name: "resume" }],
    );

    // Both start with "r"; the action is what Cmd+K was pressed for.
    expect(filterCommands(items, "r").map((item) => item.name)).toEqual(["Rename session", "readonly", "resume"]);
  });

  it("still puts prefix matches above substring matches", () => {
    expect(filterCommands(commands, "pdf").map((item) => item.name)).toEqual(["pdf", "preview-pdf"]);
  });
});

describe("new session action", () => {
  const actions = [
    { name: "New session", description: "Open a new session in this project", run: () => {} },
    { name: "Rename session", description: "Set the display name", run: () => {} },
  ];

  it("is reachable by typing /new", () => {
    const items = menuItems(actions, commands);

    expect(filterCommands(items, "new").map((item) => item.name)).toEqual(["New session"]);
  });

  it("runs its callback rather than inserting a slash command", () => {
    let opened = 0;
    const items = menuItems([{ name: "New session", description: "", run: () => { opened += 1; } }], commands);
    const [item] = filterCommands(items, "new");

    expect(item).toMatchObject({ kind: "action" });
    if (item!.kind === "action") item!.run();
    expect(opened).toBe(1);
  });
});
