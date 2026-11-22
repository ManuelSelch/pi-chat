import type { PiClient } from "../client.js";
import type { CancellationSignal } from "../platform.js";

export type CommandPlacement = "menus" | "projects";

export interface PluginCommand {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly placements: readonly CommandPlacement[];
  readonly disabled?: boolean;
  run(): void;
}

/** Browser shell capabilities, not access to its controller or feature stores. */
export interface WebPluginHost {
  readonly connected: boolean;
  readonly projectPath?: string;
  request<T>(invoke: (client: PiClient) => Promise<T>): Promise<T>;
  /** Creates a session and navigates to it; rejection leaves navigation unchanged. */
  createSession(path: string, signal?: CancellationSignal): Promise<string>;
  useOverlayFocus(opened: boolean): {
    readonly returnFocus: false;
    readonly onExitTransitionEnd: () => void;
  };
}

export interface WebPluginContributions<Overlay = unknown> {
  readonly commands: readonly PluginCommand[];
  readonly overlay?: Overlay;
  readonly blocking?: boolean;
}

/** The browser calls this hook inside a stable, plugin-owned React scope.
 * Overlay stays generic so SDK declarations have no React dependency.
 */
export interface WebPlugin<Overlay = unknown> {
  readonly id: string;
  useContributions(host: WebPluginHost): WebPluginContributions<Overlay>;
}
