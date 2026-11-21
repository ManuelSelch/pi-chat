import { describe, expect, it } from "vitest";
import { operationSchemas, snapshotSchema, presentationSchema, initializeResultSchema } from "../../src/protocol/v2.js";
import { snap, summary, initialized } from "../v2-fixtures.js";
import { themeFixture } from "../theme-fixture.js";

describe.each(["session.open", "session.create"] as const)("%s theme result", method => {
  const schema = operationSchemas[method].result;
  const opened = { summary: summary(), snapshot: snap(), theme: themeFixture };
  it("retains concrete palette data alongside summary and snapshot", () => {
    expect(schema.parse(opened)).toEqual(opened);
  });
  it("requires theme and rejects missing or null palettes", () => {
    expect(schema.safeParse({ summary: summary(), snapshot: snap() }).success).toBe(false);
    expect(schema.safeParse({ ...opened, theme: null }).success).toBe(false);
  });
  it.each(["", "#abc", "#gggggg", "red", "var(--accent)", "oklch(60% .1 200)", "\x1b[31m"])("rejects non-concrete hex color %j", color => {
    expect(schema.safeParse({ ...opened, theme: { ...themeFixture, colors: { ...themeFixture.colors, accent: color } } }).success).toBe(false);
    expect(schema.safeParse({ ...opened, theme: { ...themeFixture, surfaces: { ...themeFixture.surfaces, pageBg: color } } }).success).toBe(false);
  });
  it("bounds names and requires appearance and all mapped roles/surfaces", () => {
    for (const name of ["", "x".repeat(129), "bad\u0000name"]) expect(schema.safeParse({ ...opened, theme: { ...themeFixture, name } }).success).toBe(false);
    for (const appearance of ["auto", null, undefined]) expect(schema.safeParse({ ...opened, theme: { ...themeFixture, appearance } }).success).toBe(false);
    for (const role of Object.keys(themeFixture.colors)) {
      const colors: Partial<typeof themeFixture.colors> = { ...themeFixture.colors }; delete colors[role as keyof typeof colors];
      expect(schema.safeParse({ ...opened, theme: { ...themeFixture, colors } }).success).toBe(false);
    }
    for (const role of Object.keys(themeFixture.surfaces)) {
      const surfaces: Partial<typeof themeFixture.surfaces> = { ...themeFixture.surfaces }; delete surfaces[role as keyof typeof surfaces];
      expect(schema.safeParse({ ...opened, theme: { ...themeFixture, surfaces } }).success).toBe(false);
    }
  });
  it("accepts explicit light appearance and uppercase RGB", () => {
    expect(schema.parse({ ...opened, theme: { ...themeFixture, appearance: "light", colors: { ...themeFixture.colors, accent: "#AABBCC" } } })).toMatchObject({ theme: { appearance: "light", colors: { accent: "#AABBCC" } } });
  });
});

it("does not add theme to summaries, snapshots, presentation or initialization", () => {
  const snapshot = snap();
  expect(snapshotSchema.parse({ ...snapshot, theme: themeFixture })).not.toHaveProperty("theme");
  expect(presentationSchema.parse({ revision: 0, widgets: [], footer: [], extensions: { buttons: [], badges: [], state: {} }, theme: themeFixture })).not.toHaveProperty("theme");
  expect(initializeResultSchema.parse({ ...initialized(), theme: themeFixture })).not.toHaveProperty("theme");
  const result = operationSchemas["session.open"].result.parse({ summary: { ...summary(), theme: themeFixture }, snapshot, theme: themeFixture });
  expect(result.summary).not.toHaveProperty("theme");
});
