import type { PiClient } from "../client.js";
import type { CancellationSignal } from "../platform.js";

export type CommandPlacement = "menus" | "projects";
export type PluginUIPlacement = "settings.feature-toggles" | "side-panel";

export interface PluginUIContext {
  readonly view: "home" | "transcript";
}

/** Minimal browser session projection; no application navigation or transcript state. */
export interface PluginSessionSummary {
  readonly sessionId: string;
  readonly status: "idle" | "running" | "blocked";
}

export type PluginUIContribution<View> = {
  readonly id: string;
  Component(): View;
} & ({
  readonly placement: "settings.feature-toggles";
} | {
  readonly placement: "side-panel";
  readonly label: string;
  readonly available?: (context: PluginUIContext) => boolean;
  Icon(): View;
});

export interface PluginCommand {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly placements: readonly CommandPlacement[];
  readonly disabled?: boolean;
  run(): void;
}

/** Browser shell capabilities, not access to its controller or feature stores. */
export interface PluginUIHost {
  readonly connected: boolean;
  readonly sessions: readonly PluginSessionSummary[];
  readonly projectPath?: string;
  request<T>(invoke: (client: PiClient) => Promise<T>): Promise<T>;
  /** Creates a session and navigates to it; rejection leaves navigation unchanged. */
  createSession(path: string, signal?: CancellationSignal): Promise<string>;
  useOverlayFocus(opened: boolean): {
    readonly returnFocus: false;
    readonly onExitTransitionEnd: () => void;
  };
}

/** Static metadata plus an action hook that reads the plugin's own context. */
export interface PluginCommandDefinition extends Omit<PluginCommand, "run" | "disabled"> {
  useAction(): Pick<PluginCommand, "run" | "disabled">;
}

export interface PluginUIProviderProps<View> {
  readonly host: PluginUIHost;
  readonly children: View;
}

/** Plain UI composition. View stays generic to keep the SDK React-free. */
export interface PluginUI<View = unknown> {
  Provider(props: PluginUIProviderProps<View>): View;
  readonly commands?: readonly PluginCommandDefinition[];
  readonly contributions?: readonly PluginUIContribution<View>[];
  Overlay?(): View;
  useOverlayOpen?(): boolean;
}
