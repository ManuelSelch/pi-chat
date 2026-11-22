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

/** Static metadata plus an action hook that reads the plugin's own context. */
export interface PluginCommandDefinition extends Omit<PluginCommand, "run" | "disabled"> {
  useAction(): Pick<PluginCommand, "run" | "disabled">;
}

export interface WebPluginProviderProps<View> {
  readonly host: WebPluginHost;
  readonly children: View;
}

/** Plain UI composition. View stays generic to keep the SDK React-free. */
export interface WebPlugin<View = unknown> {
  readonly id: string;
  Provider(props: WebPluginProviderProps<View>): View;
  readonly commands: readonly PluginCommandDefinition[];
  Overlay(): View;
  useOverlayOpen(): boolean;
}
