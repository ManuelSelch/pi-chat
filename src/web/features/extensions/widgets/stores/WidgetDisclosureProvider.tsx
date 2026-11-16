import { createContext, useContext, useState, type ReactNode } from "react";

interface WidgetDisclosure {
  collapsed: ReadonlySet<string>;
  toggle: (key: string) => void;
}

const WidgetDisclosureContext = createContext<WidgetDisclosure | undefined>(undefined);

/** Browser-page preferences, shared across sessions and widget placements. */
export function WidgetDisclosureProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());

  function toggle(key: string) {
    setCollapsed(previous => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return <WidgetDisclosureContext.Provider value={{ collapsed, toggle }}>{children}</WidgetDisclosureContext.Provider>;
}

export function useWidgetDisclosure(key: string) {
  const disclosure = useContext(WidgetDisclosureContext);
  if (!disclosure) throw new Error("useWidgetDisclosure must be used inside WidgetDisclosureProvider");
  return { open: !disclosure.collapsed.has(key), toggle: () => disclosure.toggle(key) };
}
