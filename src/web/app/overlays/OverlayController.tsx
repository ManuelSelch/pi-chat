import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import type { Tab } from "../../../shared/protocol.js";

export type OverlayName = "projects" | "folderPicker" | "settings" | "quickOpen" | "closingTab" | "renamingSession";

export interface OverlayState {
  projects: boolean;
  folderPicker: boolean;
  settings: boolean;
  quickOpen: boolean;
  closingTab?: Tab;
  renamingSession?: string;
}

interface OverlayAction {
  type: "open" | "close" | "toggle" | "closeAll" | "requestCloseTab" | "requestRename";
  name?: OverlayName;
  tab?: Tab;
  value?: string;
}

const initialState: OverlayState = {
  projects: false,
  folderPicker: false,
  settings: false,
  quickOpen: false,
};

function reduce(state: OverlayState, action: OverlayAction): OverlayState {
  if (action.type === "closeAll") return initialState;
  if (action.type === "requestCloseTab") return { ...state, closingTab: action.tab };
  if (action.type === "requestRename") return { ...state, renamingSession: action.value };
  if (!action.name) return state;
  if (action.type === "open") {
    if (action.name === "closingTab" || action.name === "renamingSession") return state;
    return { ...state, [action.name]: true } as OverlayState;
  }
  if (action.type === "close") return { ...state, [action.name]: action.name === "closingTab" || action.name === "renamingSession" ? undefined : false };
  return { ...state, [action.name]: !state[action.name] } as OverlayState;
}

interface OverlayControllerValue {
  state: OverlayState;
  anyOpen: boolean;
  open(name: OverlayName): void;
  close(name: OverlayName): void;
  toggle(name: OverlayName): void;
  requestCloseTab(tab: Tab): void;
  requestRename(value: string): void;
  closeAll(): void;
}

const OverlayContext = createContext<OverlayControllerValue | undefined>(undefined);

export function OverlayController({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const value = useMemo<OverlayControllerValue>(() => ({
    state,
    anyOpen: state.projects || state.folderPicker || state.settings || state.quickOpen || state.closingTab !== undefined || state.renamingSession !== undefined,
    open: (name) => dispatch({ type: "open", name }),
    close: (name) => dispatch({ type: "close", name }),
    toggle: (name) => dispatch({ type: "toggle", name }),
    requestCloseTab: (tab) => dispatch({ type: "requestCloseTab", tab }),
    requestRename: (value) => dispatch({ type: "requestRename", value }),
    closeAll: () => dispatch({ type: "closeAll" }),
  }), [state]);

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

export function useOverlays(): OverlayControllerValue {
  const value = useContext(OverlayContext);
  if (!value) throw new Error("useOverlays must be used inside OverlayController");
  return value;
}
