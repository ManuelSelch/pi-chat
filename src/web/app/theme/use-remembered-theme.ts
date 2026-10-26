import { useEffect, useState } from "react";
import type { SessionTheme } from "@manuelselch/pi-sdk";
import { sessionThemeSchema } from "@manuelselch/pi-sdk/protocol";

const STORAGE_KEY = "pi-chat:lastTheme";

function readRememberedTheme(): SessionTheme | undefined {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? sessionThemeSchema.safeParse(JSON.parse(stored)).data : undefined;
  } catch {
    // Storage can be unavailable or contain invalid JSON.
    return undefined;
  }
}

/** Application appearance only; never restore this palette into the SDK cache. */
export function useRememberedTheme(palette?: SessionTheme): SessionTheme | undefined {
  const [remembered, setRemembered] = useState(readRememberedTheme);
  useEffect(() => {
    if (!palette) return;
    setRemembered(palette);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(palette));
    } catch {
      // Keep the in-memory appearance even when persistence is denied/full.
    }
  }, [palette]);
  return palette ?? remembered;
}
