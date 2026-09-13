import type { RuntimeAdapter, RuntimeEvent, RuntimeSnapshot } from "./runtime-adapter.js";

export class ChatApplicationService {
  constructor(private readonly runtime: RuntimeAdapter) {}

  snapshot(): RuntimeSnapshot {
    return this.runtime.snapshot();
  }

  prompt(message: string): Promise<void> {
    return this.runtime.prompt(message);
  }

  abort(): Promise<void> {
    return this.runtime.abort();
  }

  subscribe(listener: (event: RuntimeEvent) => void): () => void {
    return this.runtime.subscribe(listener);
  }

  dispose(): Promise<void> | void {
    return this.runtime.dispose();
  }
}
