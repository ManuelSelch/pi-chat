import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { useMediaQuery } from "@mantine/hooks";
import { usePluginOverlayOpen } from "../plugins/PluginProvider.js";

export type OverlayName = "projects" | "settings" | "quickOpen";

export interface OverlayState {
  projects: boolean;
  settings: boolean;
  quickOpen: boolean;
}

interface OverlayAction {
  type: "open" | "close" | "toggle" | "closeAll";
  name?: OverlayName;
}

const initialState: OverlayState = {
  projects: false,
  settings: false,
  quickOpen: false,
};

function reduce(state: OverlayState, action: OverlayAction): OverlayState {
  if (action.type === "closeAll") return initialState;
  if (!action.name) return state;
  if (action.type === "open") return { ...state, [action.name]: true };
  if (action.type === "close") return { ...state, [action.name]: false };
  return { ...state, [action.name]: !state[action.name] } as OverlayState;
}

interface OverlayControllerValue {
  state: OverlayState;
  /** Blocking overlays only; desktop project navigation does not own focus. */
  anyOpen: boolean;
  projectsPresentation: "sidebar" | "drawer";
  open(name: OverlayName): void;
  close(name: OverlayName): void;
  toggle(name: OverlayName): void;
  closeAll(): void;
}

const OverlayContext = createContext<OverlayControllerValue | undefined>(undefined);

export function OverlayController({ children }: { children: ReactNode }) {
  const blocking = usePluginOverlayOpen();
  const [state, dispatch] = useReducer(reduce, initialState);
  const desktop = useMediaQuery("(min-width: 640px)", undefined, { getInitialValueInEffect: false });
  const value = useMemo<OverlayControllerValue>(() => ({
    state,
    projectsPresentation: desktop ? "sidebar" : "drawer",
    anyOpen: (!desktop && state.projects) || blocking || state.settings || state.quickOpen,
    open: (name) => dispatch({ type: "open", name }),
    close: (name) => dispatch({ type: "close", name }),
    toggle: (name) => dispatch({ type: "toggle", name }),
    closeAll: () => dispatch({ type: "closeAll" }),
  }), [state, desktop, blocking]);

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

export function useOverlays(): OverlayControllerValue {
  const value = useContext(OverlayContext);
  if (!value) throw new Error("useOverlays must be used inside OverlayController");
  return value;
}
