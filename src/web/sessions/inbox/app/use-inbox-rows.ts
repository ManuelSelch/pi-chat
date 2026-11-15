import { useMemo } from "react";
import { visibleTabs, type AppState } from "../../../app/state/app-state.js";
import { inboxRows } from "../domain/inbox-model.js";

export function useInboxRows(app: AppState, later: readonly { path?: string }[]) {
  return useMemo(() => inboxRows(visibleTabs(app), app.catalogue, new Set(later.flatMap(row => row.path ? [row.path] : []))), [app.tabs, app.closingSessionIds, app.catalogue, later]);
}
