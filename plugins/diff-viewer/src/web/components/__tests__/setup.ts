import { vi } from "vitest";

if (typeof window !== "undefined") {
  Object.defineProperty(document,"fonts",{configurable:true,value:{addEventListener:vi.fn(),removeEventListener:vi.fn()}});
  window.matchMedia = (media: string) => ({
    matches: false, media, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  });
  window.IntersectionObserver = class {
    readonly root = null;
    readonly rootMargin = "";
    readonly scrollMargin = "";
    readonly thresholds = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
