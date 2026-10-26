import { describe, expect, it, vi } from "vitest";
import { loadEndpoint, saveEndpoint, ENDPOINT_STORAGE_KEY } from "../../../../../../src/web/settings/server/infra/endpoint-store.js";

const page = { protocol: "https:", host: "pi.example", search: "?page=only" };
function storage(value: string | null = null) {
  return { getItem: vi.fn(() => value), setItem: vi.fn(), removeItem: vi.fn() };
}
describe("server endpoint storage", () => {
  it("uses the page default when absent", () => {
    const store = storage();
    expect(loadEndpoint(page, () => store)).toEqual({ endpoint: "wss://pi.example/ws?page=only", override: "", hasStoredOverride: false });
    expect(store.getItem).toHaveBeenCalledWith(ENDPOINT_STORAGE_KEY);
  });
  it("restores only the explicit URL without appending page query", () => {
    expect(loadEndpoint(page, () => storage("  wss://pi.example/ws?custom=only  "))).toEqual({
      endpoint: "wss://pi.example/ws?custom=only", override: "wss://pi.example/ws?custom=only", hasStoredOverride: true,
    });
  });
  it("ignores invalid stored data while allowing reset", () => {
    const result = loadEndpoint(page, () => storage("ws://insecure/ws"));
    expect(result.endpoint).toBe("wss://pi.example/ws?page=only");
    expect(result.override).toBe("");
    expect(result.hasStoredOverride).toBe(true);
    expect(result.warning).toBeTruthy();
    expect(result.warning).not.toContain("insecure");
  });
  it("survives unavailable storage with a visible warning", () => {
    const result = loadEndpoint(page, () => { throw Error("denied"); });
    expect(result.endpoint).toBe("wss://pi.example/ws?page=only");
    expect(result.warning).toBeTruthy();
  });
  it("saves a trimmed override and removes only this key on reset", () => {
    const store = storage();
    expect(saveEndpoint(" wss://pi.example/ws ", page.protocol, () => store)).toBeUndefined();
    expect(store.setItem).toHaveBeenCalledWith(ENDPOINT_STORAGE_KEY, "wss://pi.example/ws");
    expect(saveEndpoint("", page.protocol, () => store)).toBeUndefined();
    expect(store.removeItem).toHaveBeenCalledWith(ENDPOINT_STORAGE_KEY);
  });
  it("does not touch storage for invalid input", () => {
    const get = vi.fn(() => storage());
    expect(saveEndpoint("http://invalid", page.protocol, get)).toBeTruthy();
    expect(get).not.toHaveBeenCalled();
  });
  it.each(["setItem", "removeItem"] as const)("reports %s failure instead of claiming success", method => {
    const store = storage();
    store[method].mockImplementation(() => { throw Error("sensitive detail"); });
    const error = saveEndpoint(method === "setItem" ? "wss://pi.example/ws" : "", page.protocol, () => store);
    expect(error).toContain("Could not save");
    expect(error).not.toContain("sensitive detail");
  });
});
