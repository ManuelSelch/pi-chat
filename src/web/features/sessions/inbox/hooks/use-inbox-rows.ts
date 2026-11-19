import { useMemo } from "react";
import { visibleTabs, type AppState } from "../../../../app/stores/app-state.js";
import { inboxRows } from "../utils/inbox-model.js";

export function useInboxRows(app: AppState, later: readonly { path?: string }[], archivingPaths: readonly string[] = []) {
  return useMemo(() => inboxRows(visibleTabs(app), app.catalogue, new Set([...archivingPaths, ...later.flatMap(row => row.path ? [row.path] : [])])), [app.tabs, app.closingSessionIds, app.catalogue, later, archivingPaths]);
}
