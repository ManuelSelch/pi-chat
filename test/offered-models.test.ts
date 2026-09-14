import { afterEach, describe, expect, it, vi } from "vitest";
import { offeredModels } from "../src/server/pi-runtime-adapter.js";

const model = (provider: string, id: string) => ({
  provider,
  id,
  name: id,
  api: "anthropic-messages",
  baseUrl: "https://example.test",
  contextWindow: 200000,
  maxTokens: 8192,
  reasoning: true,
  input: ["text"],
  cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
});

const CATALOGUE = [
  model("anthropic", "claude-opus-5"),
  model("anthropic", "claude-sonnet-5"),
  model("openai", "gpt-5"),
  model("openrouter", "meta/llama-3"),
  model("ollama", "qwen3:8b"),
];

/** Only the two members `offeredModels` reads. */
function fakeSession(enabledModels?: string[]) {
  return {
    modelRuntime: {
      getAvailable: async () => CATALOGUE,
      getAvailableSnapshot: () => CATALOGUE,
    },
    settingsManager: { getEnabledModels: () => enabledModels },
  } as unknown as Parameters<typeof offeredModels>[0];
}

afterEach(() => vi.restoreAllMocks());

describe("which models the browser offers", () => {
  it("offers everything when no shortlist is configured", async () => {
    expect(await offeredModels(fakeSession())).toEqual([
      "anthropic/claude-opus-5",
      "anthropic/claude-sonnet-5",
      "ollama/qwen3:8b",
      "openai/gpt-5",
      "openrouter/meta/llama-3",
    ]);
  });

  it("offers everything when the shortlist is present but empty", async () => {
    expect(await offeredModels(fakeSession([]))).toHaveLength(CATALOGUE.length);
  });

  it("narrows to exact references", async () => {
    const offered = await offeredModels(fakeSession(["anthropic/claude-opus-5", "openai/gpt-5"]));
    expect(offered).toEqual(["anthropic/claude-opus-5", "openai/gpt-5"]);
  });

  // The setting takes glob patterns, which is what makes it practical for a
  // provider with a huge catalogue.
  it("narrows by provider glob", async () => {
    expect(await offeredModels(fakeSession(["anthropic/*"]))).toEqual([
      "anthropic/claude-opus-5",
      "anthropic/claude-sonnet-5",
    ]);
  });

  it("matches a bare model id without naming the provider", async () => {
    expect(await offeredModels(fakeSession(["*sonnet*"]))).toEqual(["anthropic/claude-sonnet-5"]);
  });

  it("accepts a thinking level suffix without losing the model", async () => {
    expect(await offeredModels(fakeSession(["anthropic/claude-opus-5:high"]))).toEqual(["anthropic/claude-opus-5"]);
  });

  // A typo would otherwise leave nothing to pick, which is worse than
  // ignoring the setting.
  it("falls back to every model when the shortlist matches nothing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const offered = await offeredModels(fakeSession(["anthropric/typo-*"]));

    expect(offered).toHaveLength(CATALOGUE.length);
    expect(warn.mock.calls.flat().join(" ")).toContain("enabledModels");
  });

  // The shortlist actually in use. OpenRouter ids contain a slash of their
  // own, so the reference has two and must not be read as a glob.
  it("resolves a reference whose model id contains a slash", async () => {
    const withOpenRouter = fakeSession([
      "anthropic/claude-opus-5",
      "openrouter/meta/llama-3",
    ]);

    expect(await offeredModels(withOpenRouter)).toEqual(["anthropic/claude-opus-5", "openrouter/meta/llama-3"]);
  });

  it("keeps the models that do match when only some patterns are wrong", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const offered = await offeredModels(fakeSession(["anthropic/claude-opus-5", "nope/*"]));

    expect(offered).toEqual(["anthropic/claude-opus-5"]);
  });
});
