import { describe, expect, it } from "vitest";
import { commandQuery, filterCommands } from "../src/web/commands/command-menu.js";

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
