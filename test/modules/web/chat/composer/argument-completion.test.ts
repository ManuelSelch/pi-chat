import { describe, expect, it } from "vitest";
import { argumentContext, applyArgumentCompletion } from "../../../../../src/web/chat/composer/argument-completion.js";

const commands = [{ name: "deploy:2", source: "extension" as const }];
describe("argument completion", () => {
  it("passes the complete prefix including empty arguments and whitespace", () => {
    expect(argumentContext("/deploy:2 ", 10, 10, commands)).toMatchObject({ commandName: "deploy:2", argumentPrefix: "" });
    const input = '/deploy:2 one  "st';
    expect(argumentContext(input, input.length, input.length, commands)?.argumentPrefix).toBe('one  "st');
  });
  it("replaces the entire prefix with Pi's complete argument value", () => {
    const input = "/deploy:2 first st";
    const context = argumentContext(input, input.length, input.length, commands)!;

    expect(context.argumentPrefix).toBe("first st");
    expect(applyArgumentCompletion(input, context, "first staging")).toEqual({
      input: "/deploy:2 first staging",
      caret: 23,
    });
  });
  it("lets Pi own separators and quotes while preserving the suffix", () => {
    const spaced = "/deploy:2 first  st --flag\nnotes";
    const spacedContext = argumentContext(spaced, 19, 19, commands)!;
    expect(applyArgumentCompletion(spaced, spacedContext, "first  staging")).toEqual({
      input: "/deploy:2 first  staging --flag\nnotes",
      caret: 24,
    });

    const quoted = '/deploy:2 first "st';
    const quotedContext = argumentContext(quoted, quoted.length, quoted.length, commands)!;
    expect(applyArgumentCompletion(quoted, quotedContext, 'first "staging')).toEqual({
      input: '/deploy:2 first "staging',
      caret: 24,
    });
  });
  it("replaces completed arguments rather than duplicating them", () => {
    const input = "/deploy:2 first ";
    const context = argumentContext(input, input.length, input.length, commands)!;
    expect(applyArgumentCompletion(input, context, "first second")).toEqual({
      input: "/deploy:2 first second",
      caret: 22,
    });
  });
  it("preserves suffixes and later lines, inserting values verbatim", () => {
    const input = "/deploy:2 st --flag\nnotes";
    const context = argumentContext(input, 12, 12, commands)!;
    expect(applyArgumentCompletion(input, context, "staging")).toEqual({ input: "/deploy:2 staging --flag\nnotes", caret: 17 });
  });
  it("ignores unknown commands, prose, native commands, selections, and later lines", () => {
    for (const input of ["cd /deploy:2 st", "/unknown st", "/deploy:2\nst"]) {
      expect(argumentContext(input, input.length, input.length, commands)).toBeUndefined();
    }
    expect(argumentContext("/deploy:2 st", 10, 12, commands)).toBeUndefined();
    expect(argumentContext("/model st", 9, 9, [{ name: "model", source: "native" }])).toBeUndefined();
  });
});
